/**
 * One entry point from a Storyboard v1 to a queued production job.
 *
 * `produceFromStoryboard` lints the storyboard, plans it onto the existing scene
 * model, creates the editable project (scenes, stock media, music, sound cues),
 * and queues a single durable job that synthesizes narration, aligns captions,
 * renders and verifies the MP4. REST, MCP and the CLI share this function.
 * The project stays editable in the existing editor.
 */
import { createHash, randomUUID } from "node:crypto";

import type { RequestAuthorization } from "@/server/auth";
import { enrichScenePlan } from "@/library/enrich-scene-plan";
import {
  resolveAutomaticSceneMediaBatch,
  type AutomaticMediaDecision,
} from "@/library/automatic-stock-media";
import { getAssets } from "@/library/repositories/assets";
import { getProductionJobByIdempotencyKey } from "@/library/repositories/production-jobs";
import { createProjectFromPlan } from "@/library/repositories/projects";
import { getScript, updateScript } from "@/library/repositories/scripts";
import { submitProduction } from "@/library/production-service";
import { autoAttachBundledMusic } from "@/library/soundtrack-service";
import { ensureSfxCues } from "@/library/sfx-service";
import { reportStockMediaSelectionUsage } from "@/library/stock-media-usage";
import { MUSIC_LIBRARY } from "@/lib/music-library";
import type { SceneBackground } from "@/video/types";
import {
  planFromStoryboard,
  type StoryboardProductionPlan,
} from "@/production/storyboard-plan";
import { lintStoryboard, type LintResult } from "@/storyboard";
import { ProviderError } from "@/providers/voice/types";

export interface ProduceFromStoryboardOptions {
  quality?: "draft" | "standard" | "high";
  /** Resolve and return the plan without creating anything or rendering. */
  dryRun?: boolean;
  /** Produce again even when the same storyboard and options already ran. */
  force?: boolean;
  minSeconds?: number;
  maxSeconds?: number;
  auth: RequestAuthorization;
  serverBaseUrl: string;
}

/** Thrown when the storyboard has errors that cannot be repaired. */
export class StoryboardLintError extends Error {
  constructor(readonly lint: LintResult) {
    super("The storyboard has errors that cannot be repaired");
    this.name = "StoryboardLintError";
  }
}

export interface StoryboardPreview {
  dryRun: true;
  hash: string;
  fixes: LintResult["fixes"];
  warnings: LintResult["warnings"];
  plan: Pick<
    StoryboardProductionPlan,
    | "orientation"
    | "music"
    | "voice"
    | "captions"
    | "scenes"
    | "estimatedSeconds"
    | "warnings"
  >;
}

export interface StoryboardProduction {
  dryRun: false;
  jobId: string;
  projectId: string;
  scriptId: string | null;
  state: string;
  /** True when an earlier identical request was returned instead of a new job. */
  reused: boolean;
  hash: string;
  fixes: LintResult["fixes"];
  warnings: LintResult["warnings"];
  planWarnings: string[];
  estimatedSeconds: number;
}

/** Stable JSON: object keys sorted, so equal storyboards hash equally. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function storyboardHash(
  storyboard: unknown,
  options: Pick<ProduceFromStoryboardOptions, "quality"> = {},
): string {
  return createHash("sha256")
    .update(canonical({ storyboard, quality: options.quality ?? "standard" }))
    .digest("hex");
}

export async function produceFromStoryboard(
  input: unknown,
  options: ProduceFromStoryboardOptions,
): Promise<StoryboardPreview | StoryboardProduction> {
  const linted = lintStoryboard(input, {
    minSeconds: options.minSeconds,
    maxSeconds: options.maxSeconds,
  });
  if (!linted.storyboard) throw new StoryboardLintError(linted);
  const storyboard = linted.storyboard;
  if (storyboard.kind !== "video") {
    throw new ProviderError(
      "Podcast storyboards are not produced by this entry point yet; create the podcast through the podcast tools",
      400,
    );
  }

  const plan = planFromStoryboard(storyboard, {
    knownTrackIds: MUSIC_LIBRARY.map((track) => track.id),
  });
  const quality = options.quality ?? "standard";
  const hash = storyboardHash(storyboard, { quality });
  const fixes = linted.fixes;
  const warnings = linted.warnings;

  if (options.dryRun) {
    const { scenes, orientation, music, voice, captions, estimatedSeconds } =
      plan;
    return {
      dryRun: true,
      hash,
      fixes,
      warnings,
      plan: {
        scenes,
        orientation,
        music,
        voice,
        captions,
        estimatedSeconds,
        warnings: plan.warnings,
      },
    };
  }

  const key = `storyboard:${hash}`;
  if (!options.force) {
    const existing = await getProductionJobByIdempotencyKey(key);
    if (existing?.productionRevision) {
      return {
        dryRun: false,
        jobId: existing.id,
        projectId: existing.productionRevision.projectId,
        scriptId: existing.productionRevision.scriptId,
        state: existing.state,
        reused: true,
        hash,
        fixes,
        warnings,
        planWarnings: plan.warnings,
        estimatedSeconds: plan.estimatedSeconds,
      };
    }
  }

  // Uploaded library assets named by the storyboard become scene backgrounds.
  const namedAssetIds = plan.assetIds.filter((id): id is string => Boolean(id));
  const assets = namedAssetIds.length ? await getAssets(namedAssetIds) : [];
  const missing = namedAssetIds.filter(
    (id) => !assets.some((a) => a.id === id),
  );
  if (missing.length > 0) {
    throw new ProviderError(
      `Asset not found in the library: ${missing.join(", ")}`,
      404,
    );
  }
  const uploaded: Array<SceneBackground | undefined> = plan.assetIds.map(
    (id) => {
      const asset = id ? assets.find((a) => a.id === id) : undefined;
      if (!asset) return undefined;
      return asset.type === "image"
        ? { type: "image", url: asset.url, effect: "ken-burns" }
        : asset.type === "video"
          ? { type: "video", url: asset.url, muted: true }
          : undefined;
    },
  );

  const enriched = {
    ...plan.scenePlan,
    scenes: enrichScenePlan(plan.scenePlan.scenes, "hyperframes"),
  };
  const wantsMedia = enriched.scenes.some(
    (scene) => scene.templateId === "hf-broll",
  );
  const mediaPreference = wantsMedia ? ("auto" as const) : ("none" as const);
  const decisions: AutomaticMediaDecision[] = wantsMedia
    ? await resolveAutomaticSceneMediaBatch(
        enriched.scenes,
        plan.orientation,
        enriched.scenes.map(() => mediaPreference),
        uploaded,
      )
    : uploaded.map((background) => ({
        state: background ? "explicit" : "disabled",
        attemptedProviders: [],
        message: "No stock media requested",
        background,
      }));
  const backgrounds = decisions.map((decision) => decision.background);
  // Without a background a media scene falls back to an animated statement.
  const finalPlan = {
    ...enriched,
    scenes: enriched.scenes.map((scene, index) =>
      scene.templateId === "hf-broll" && !backgrounds[index]
        ? {
            ...scene,
            templateId: "hf-statement" as const,
            backgroundQuery: undefined,
            mediaKind: undefined,
          }
        : scene,
    ),
  };

  const created = await createProjectFromPlan(
    finalPlan,
    plan.orientation,
    backgrounds,
    "hyperframes",
    { styleId: finalPlan.styleId, energy: finalPlan.energy },
    {
      mediaPreferences: finalPlan.scenes.map(() => mediaPreference),
      stockSelections: decisions.map((decision) => decision.snapshot),
      outputType: "video",
      creationSource: { kind: "text" },
    },
  );
  const persisted = await getScript(created.scriptId);
  for (const scene of persisted?.scenes ?? []) {
    await reportStockMediaSelectionUsage(scene.id).catch(() => undefined);
  }

  if (plan.music.mode === "auto") {
    await autoAttachBundledMusic(created.scriptId);
  } else if (plan.music.mode === "track") {
    const track = MUSIC_LIBRARY.find((t) => t.id === plan.music.trackId);
    if (track) await updateScript(created.scriptId, { musicUrl: track.url });
  }
  await ensureSfxCues(created.scriptId);

  const job = await submitProduction({
    request: {
      kind: "video",
      scriptId: created.scriptId,
      orientation: plan.orientation,
      quality,
      idempotencyKey: options.force ? `${key}:${randomUUID()}` : key,
      runMode: "automatic",
      priority: 0,
      quickProduce: {
        enabled: true,
        planner: "deterministic",
        mediaPreference,
        voice: {
          enabled: plan.voice.enabled,
          providerId: "kokoro-server",
          voiceId: plan.voice.voiceId ?? "af_heart",
        },
      },
      captions: plan.captions,
      storyboard: {
        hash,
        title: storyboard.title,
        fixes: fixes
          .map((f) => `${f.path || "root"}: ${f.message}`)
          .slice(0, 200),
        warnings: [
          ...warnings.map((w) => `${w.path || "root"}: ${w.message}`),
          ...plan.warnings,
        ].slice(0, 200),
      },
    },
    auth: options.auth,
    serverBaseUrl: options.serverBaseUrl,
  });
  if (!job) throw new ProviderError("The production job was not created", 500);

  return {
    dryRun: false,
    jobId: job.id,
    projectId: created.projectId,
    scriptId: created.scriptId,
    state: job.state,
    reused: false,
    hash,
    fixes,
    warnings,
    planWarnings: plan.warnings,
    estimatedSeconds: plan.estimatedSeconds,
  };
}
