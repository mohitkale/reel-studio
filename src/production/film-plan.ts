import { resolveAdaptiveLayout } from "./adaptive-layout";
import { ADAPTIVE_MANIFESTS } from "@/video/adaptive-catalog";
import { createHash } from "node:crypto";
import { resolveReelTimeline } from "@/lib/reel-timeline";
import { resolveSpokenText } from "@/lib/spoken-text";
import { CURRENT_HF_CATALOG_REVISION } from "@/engines/hyperframes/catalog/versions";
import { adaptiveRecipeManifestSchema } from "@/video/adaptive-recipe";
import {
  resolvedFilmPlanSchema,
  type ResolvedFilmPlan,
} from "@/video/resolved-film-plan";
import type { VideoSnapshot } from "./video-snapshot";

/** JSON-wire canonicalization: absent and undefined fields have the same digest. */
export function filmCanonicalJson(value: unknown): string {
  const wire: unknown = JSON.parse(JSON.stringify(value));
  const sort = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(sort);
    if (item && typeof item === "object")
      return Object.fromEntries(
        Object.entries(item)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, v]) => [key, sort(v)]),
      );
    return item;
  };
  return JSON.stringify(sort(wire));
}
export const filmDigest = (value: unknown): string =>
  `sha256:${createHash("sha256").update(filmCanonicalJson(value)).digest("hex")}`;

export const COMPATIBILITY_RECIPE = adaptiveRecipeManifestSchema.parse({
  schemaVersion: 1,
  id: "saved-scene",
  version: "1.0.0",
  name: "Saved scene compatibility",
  mode: "compatibility",
  intents: ["existing-scene"],
  inputs: [{ name: "scene", kind: "scene-reference", required: true }],
  durationSeconds: { min: 0, max: 600 },
  density: {
    characters: { min: 0, max: 12000 },
    subjects: { min: 0, max: 100 },
  },
  aspects: ["portrait", "landscape", "square"].map((format) => ({
    format,
    strategy: "existing-renderer",
  })),
  tokenSlots: [
    "background",
    "foreground",
    "accent",
    "accentSecondary",
    "fontFamily",
    "radius",
  ],
  events: [],
  continuityPorts: [],
  resourceClass: "unmeasured",
  fallback: [],
  provenance: {
    origin: "bundled",
    license: "MIT",
    revision: "saved-scene-adapter-1",
  },
  fixtureIds: ["legacy", "authored-motion", "semantic-showpiece"],
});

export function filmPlanSource(snapshot: VideoSnapshot) {
  // The plan describes the captured source, never itself or a render-time media copy.
  const { filmPlan: _plan, ...source } = snapshot;
  void _plan;
  return source;
}

/** Preserve the complete scene as a binding, including all supported saved choices. */
export function resolveCompatibilityFilmPlan(
  snapshot: VideoSnapshot,
): ResolvedFilmPlan {
  const { script, take } = snapshot;
  const timing = resolveReelTimeline(
    script.scenes.map((scene) => ({
      id: scene.id,
      text: resolveSpokenText(scene),
    })),
    take,
    script.fps,
  );
  const coverFrames = script.coverUrl ? Math.round(script.fps * 1.5) : 0;
  const recipe = {
    id: COMPATIBILITY_RECIPE.id,
    version: COMPATIBILITY_RECIPE.version,
    hash: filmDigest(COMPATIBILITY_RECIPE),
  };
  const adaptive = timing.timeline.map((beat, index) =>
    resolveAdaptiveLayout(
      {
        ...script.scenes[index],
        spokenText: script.scenes[index].spokenText ?? undefined,
        hideText: script.scenes[index].hideText ?? script.hideText,
      },
      script.width,
      script.height,
      beat.durationFrames / script.fps,
    ),
  );
  const manifests = ADAPTIVE_MANIFESTS.filter((m) =>
    adaptive.some((a) => a.plan?.recipeId === m.id),
  );
  return resolvedFilmPlanSchema.parse({
    schemaVersion: 1,
    resolverVersion: manifests.length ? "1.1.0" : "1.0.0",
    mode: manifests.length ? "adaptive" : "compatibility",
    sourceHash: filmDigest(filmPlanSource(snapshot)),
    scriptId: script.id,
    seed: script.motionPlan?.seed ?? script.id,
    canvas: { width: script.width, height: script.height, fps: script.fps },
    timing: {
      source: timing.takeUsable
        ? take!.timeline.length < script.scenes.length
          ? "mixed"
          : "take"
        : "estimated",
      contentFrames: timing.totalFrames,
      coverFrames,
      totalFrames: timing.totalFrames + coverFrames,
    },
    catalogRevision: CURRENT_HF_CATALOG_REVISION,
    recipes: [
      { manifest: COMPATIBILITY_RECIPE, hash: recipe.hash },
      ...manifests.map((manifest) => ({
        manifest,
        hash: filmDigest(manifest),
      })),
    ],
    shots: timing.timeline.map((beat, index) => ({
      id: script.scenes[index].id,
      sceneId: beat.sceneId,
      order: index,
      startFrame: beat.startFrame,
      // Independent duration/start rounding can put a legacy beat one frame past the export.
      durationFrames: Math.min(
        beat.durationFrames,
        timing.totalFrames - beat.startFrame,
      ),
      recipe: adaptive[index].plan
        ? (() => {
            const manifest = manifests.find(
              (m) => m.id === adaptive[index].plan!.recipeId,
            )!;
            return {
              id: manifest.id,
              version: manifest.version,
              hash: filmDigest(manifest),
            };
          })()
        : recipe,
      ...(adaptive[index].plan
        ? { adaptive: adaptive[index].plan }
        : adaptive[index].reason
          ? { fallbackReason: adaptive[index].reason }
          : {}),
      binding: {
        kind: "snapshot-scene",
        sceneHash: filmDigest(script.scenes[index]),
      },
      layout: adaptive[index].plan ? "adaptive" : "existing-renderer",
      reason: "Preserve saved scene content, direction, media and locks.",
    })),
  });
}

export function withResolvedFilmPlan(snapshot: VideoSnapshot): VideoSnapshot {
  return { ...snapshot, filmPlan: resolveCompatibilityFilmPlan(snapshot) };
}

/** Called at the document/revision boundary, not after worker media localization. */
export function filmPlanMatchesSource(snapshot: VideoSnapshot): boolean {
  return Boolean(
    snapshot.filmPlan &&
    snapshot.filmPlan.sourceHash === filmDigest(filmPlanSource(snapshot)) &&
    filmCanonicalJson(snapshot.filmPlan) ===
      filmCanonicalJson(resolveCompatibilityFilmPlan(snapshot)),
  );
}
