import { createHash } from "node:crypto";

import type { SceneBackground } from "@/lib/dto";
import { getAsset } from "@/library/repositories/assets";
import { materializeStockMedia } from "@/library/stock-media-materialization";
import type { MediaPreference } from "@/lib/media-preference";
import type { Orientation } from "@/lib/orientation";
import {
  PEXELS_LICENSE_URL,
  selectPexelsRendition,
} from "@/providers/stock/pexels";
import {
  PIXABAY_LICENSE_URL,
  selectPixabayRendition,
} from "@/providers/stock/pixabay";
import {
  getStockMediaProviderRegistry,
  type StockMediaProviderRegistry,
} from "@/providers/stock/registry";
import type {
  ResolvedStockAsset,
  StockMediaCandidate,
  StockMediaKind,
} from "@/providers/stock/schemas";
import { UNSPLASH_API_GUIDELINES_URL } from "@/providers/stock/unsplash";

export const STOCK_MEDIA_FALLBACK_ORDER = {
  image: ["pexels", "pixabay", "unsplash"],
  video: ["pexels", "pixabay"],
} as const;

export type AutomaticMediaState =
  | "selected"
  | "explicit"
  | "disabled"
  | "no-intent"
  | "no-provider"
  | "no-result";

export interface AutomaticMediaDecision {
  state: AutomaticMediaState;
  kind?: StockMediaKind;
  providerId?: string;
  attemptedProviders: string[];
  message: string;
  background?: SceneBackground;
  snapshot?: ResolvedStockAsset;
}

export interface AutomaticMediaSceneIntent {
  backgroundQuery?: string;
  mediaKind?: StockMediaKind;
  effect?: SceneBackground["effect"];
}

interface Dependencies {
  registry: StockMediaProviderRegistry;
  materialize: typeof materializeStockMedia;
  getLocalAsset: typeof getAsset;
}

const termsUrls: Record<string, string> = {
  pexels: PEXELS_LICENSE_URL,
  pixabay: PIXABAY_LICENSE_URL,
  unsplash: UNSPLASH_API_GUIDELINES_URL,
};

function dependencies(overrides: Partial<Dependencies>): Dependencies {
  return {
    registry: getStockMediaProviderRegistry(),
    materialize: materializeStockMedia,
    getLocalAsset: getAsset,
    ...overrides,
  };
}

export function resolvePreferredMediaKind(
  preference: MediaPreference,
  aiKind?: StockMediaKind,
): StockMediaKind | null {
  if (preference === "none") return null;
  if (preference === "image" || preference === "video") return preference;
  return aiKind ?? "image";
}

export function deterministicStockCandidate(
  items: StockMediaCandidate[],
  seed: string,
): StockMediaCandidate | undefined {
  if (!items.length) return undefined;
  const value = Number.parseInt(
    createHash("sha256").update(seed).digest("hex").slice(0, 8),
    16,
  );
  return items[value % items.length];
}

function rendition(candidate: StockMediaCandidate) {
  if (candidate.providerId === "pexels")
    return selectPexelsRendition(candidate);
  if (candidate.providerId === "pixabay")
    return selectPixabayRendition(candidate);
  return candidate.renderRenditions[0]!;
}

async function background(
  snapshot: ResolvedStockAsset,
  effect: SceneBackground["effect"],
  deps: Dependencies,
): Promise<SceneBackground> {
  let url = snapshot.compliantRemoteUrl;
  if (snapshot.localAssetId) {
    const asset = await deps.getLocalAsset(snapshot.localAssetId);
    if (!asset || asset.type !== snapshot.providerSnapshot.kind) {
      throw new Error("Materialized stock asset is unavailable");
    }
    url = asset.url;
  }
  if (!url) throw new Error("Resolved stock asset has no renderable URL");
  return snapshot.providerSnapshot.kind === "video"
    ? { type: "video", url, muted: true }
    : { type: "image", url, effect: effect ?? "ken-burns" };
}

/** Resolve a bounded AI/deterministic intent through a fixed provider fallback. */
export async function resolveAutomaticSceneMedia(
  intent: AutomaticMediaSceneIntent,
  orientation: Orientation,
  preference: MediaPreference = "auto",
  options: {
    explicitBackground?: SceneBackground;
    seed?: string;
    dependencies?: Partial<Dependencies>;
  } = {},
): Promise<AutomaticMediaDecision> {
  if (options.explicitBackground) {
    return {
      state: "explicit",
      attemptedProviders: [],
      message: "Existing upload or selection kept",
      background: options.explicitBackground,
    };
  }
  const kind = resolvePreferredMediaKind(preference, intent.mediaKind);
  if (!kind) {
    return {
      state: "disabled",
      attemptedProviders: [],
      message: "Stock media disabled; using animated mood background",
    };
  }
  const query = intent.backgroundQuery?.trim();
  if (!query) {
    return {
      state: "no-intent",
      kind,
      attemptedProviders: [],
      message: "No stock search intent; using animated mood background",
    };
  }

  const deps = dependencies(options.dependencies ?? {});
  const attemptedProviders: string[] = [];
  let readyProviderCount = 0;
  for (const providerId of STOCK_MEDIA_FALLBACK_ORDER[kind]) {
    const provider = deps.registry.get(providerId);
    const health = await deps.registry.health(providerId);
    if (
      health.status !== "ready" ||
      !provider.capabilities.kinds.includes(kind)
    ) {
      continue;
    }
    readyProviderCount += 1;
    attemptedProviders.push(providerId);
    try {
      const search = await deps.registry.search(providerId, {
        query,
        kind,
        orientation,
        perPage: Math.min(12, provider.capabilities.maxPageSize),
      });
      const candidate = deterministicStockCandidate(
        search.items,
        `${options.seed ?? query}:${providerId}:${kind}:${orientation}`,
      );
      if (!candidate) continue;
      const selected = rendition(candidate);
      const resolved = await deps.registry.resolve(
        providerId,
        candidate,
        selected.id,
      );
      const snapshot = await deps.materialize({
        candidate: resolved.candidate,
        rendition: resolved.rendition,
        termsUrl: termsUrls[providerId]!,
        usageRequired: provider.capabilities.usageReporting,
      });
      return {
        state: "selected",
        kind,
        providerId,
        attemptedProviders,
        message: `${provider.label} ${kind} selected`,
        snapshot,
        background: await background(snapshot, intent.effect, deps),
      };
    } catch {
      // Search/resolve/download failures fall through to the next configured source.
    }
  }
  return {
    state: readyProviderCount ? "no-result" : "no-provider",
    kind,
    attemptedProviders,
    message: readyProviderCount
      ? "No stock result; using animated mood background"
      : "No configured stock provider; using animated mood background",
  };
}

export async function resolveAutomaticSceneMediaBatch(
  scenes: AutomaticMediaSceneIntent[],
  orientation: Orientation,
  preferences: MediaPreference[],
  explicitBackgrounds: Array<SceneBackground | undefined> = [],
): Promise<AutomaticMediaDecision[]> {
  const decisions: AutomaticMediaDecision[] = [];
  for (const [index, scene] of scenes.entries()) {
    decisions.push(
      await resolveAutomaticSceneMedia(
        scene,
        orientation,
        preferences[index] ?? "auto",
        {
          explicitBackground: explicitBackgrounds[index],
          seed: `${index}:${scene.backgroundQuery ?? ""}`,
        },
      ),
    );
  }
  return decisions;
}
