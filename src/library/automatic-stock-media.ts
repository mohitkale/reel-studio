import {
  rankStockCandidates,
  selectionRanking,
  candidateStyleTags,
  stockCandidateKey,
  stockPreviewKey,
} from "@/production/media-ranking";
import type { MediaVisionAssessment } from "@/production/media-ranking-contract";

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

export const STOCK_MEDIA_FALLBACK_ORDER = {
  // Automatic choices must survive MP4 staging. Hotlink-only sources remain
  // available for explicit preview selections, not unattended productions.
  image: ["pexels", "pixabay"],
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
  text?: string;
  spokenText?: string;
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
  return rankStockCandidates(items, { query: seed, orientation: "portrait" })[0]
    ?.candidate;
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
    ? { type: "video", url, muted: true, stock: true }
    : { type: "image", url, effect: effect ?? "ken-burns", stock: true };
}

/** Resolve a bounded AI/deterministic intent through a fixed provider fallback. */
export async function resolveAutomaticSceneMedia(
  intent: AutomaticMediaSceneIntent,
  orientation: Orientation,
  preference: MediaPreference = "auto",
  options: {
    explicitBackground?: SceneBackground;
    seed?: string;
    usedKeys?: string[];
    filmStyleTags?: string[];
    vision?: MediaVisionAssessment[];
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
  const preferredKind = resolvePreferredMediaKind(preference, intent.mediaKind);
  if (!preferredKind) {
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
      kind: preferredKind,
      attemptedProviders: [],
      message: "No stock search intent; using animated mood background",
    };
  }

  const deps = dependencies(options.dependencies ?? {});
  const attemptedProviders: string[] = [];
  let readyProviderCount = 0;
  const kinds: StockMediaKind[] =
    preference === "auto" && preferredKind === "video"
      ? ["video", "image"]
      : [preferredKind];
  for (const kind of kinds) {
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
      if (!attemptedProviders.includes(providerId)) {
        attemptedProviders.push(providerId);
      }
      try {
        const search = await deps.registry.search(providerId, {
          query,
          kind,
          orientation,
          perPage: Math.min(12, provider.capabilities.maxPageSize),
        });
        const ranked = rankStockCandidates(
          search.items.filter((item) => item.acquisitionPolicy !== "hotlink"),
          {
            query,
            orientation,
            sceneText: intent.spokenText ?? intent.text,
            usedKeys: options.usedKeys,
            filmStyleTags: options.filmStyleTags,
            vision: options.vision,
          },
        );
        const candidate = ranked[0]?.candidate;
        if (!candidate) continue;
        const selected = rendition(candidate);
        const resolved = await deps.registry.resolve(
          providerId,
          candidate,
          selected.id,
        );
        if (resolved.candidate.acquisitionPolicy === "hotlink") continue;
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
          message:
            kind === preferredKind
              ? `${provider.label} ${kind} selected`
              : `${provider.label} ${kind} selected as automatic fallback`,
          snapshot: {
            ...snapshot,
            ranking: selectionRanking(
              ranked,
              0,
              query,
              Boolean(options.vision?.length),
            ),
          },
          background: await background(snapshot, intent.effect, deps),
        };
      } catch {
        // Search/resolve/download failures fall through to the next source/kind.
      }
    }
  }
  return {
    state: readyProviderCount ? "no-result" : "no-provider",
    kind: preferredKind,
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
  const usedKeys: string[] = [];
  const filmStyleTags: string[] = [];
  for (const [index, scene] of scenes.entries()) {
    decisions.push(
      await resolveAutomaticSceneMedia(
        scene,
        orientation,
        preferences[index] ?? "auto",
        {
          explicitBackground: explicitBackgrounds[index],
          usedKeys,
          filmStyleTags,
          seed: `${index}:${scene.backgroundQuery ?? ""}`,
        },
      ),
    );
    const chosen = decisions.at(-1)?.snapshot?.providerSnapshot;
    if (chosen) {
      usedKeys.push(stockCandidateKey(chosen), stockPreviewKey(chosen));
      filmStyleTags.push(...candidateStyleTags(chosen));
    }
  }
  return decisions;
}
