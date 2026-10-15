import { describe, expect, it } from "vitest";
import { filmSnapshot } from "../../tests/fixtures/film-plan";
import { adaptiveRecipeManifestSchema } from "@/video/adaptive-recipe";
import { resolvedFilmPlanSchema } from "@/video/resolved-film-plan";
import { videoSnapshotSchema } from "./video-snapshot";
import { filmPlanDocumentSchema } from "./film-plan-document";
import {
  COMPATIBILITY_RECIPE,
  filmDigest,
  filmPlanMatchesSource,
  resolveCompatibilityFilmPlan,
  withResolvedFilmPlan,
} from "./film-plan";
import { videoRevisionHash } from "@/library/production-revision";
import { resolveReelTimeline } from "@/lib/reel-timeline";
import { buildHyperframesCompositionHtml } from "@/engines/hyperframes/build-composition";
import { prepareVideoComposition } from "@/library/render-service";

describe("M1 compatibility contracts", () => {
  it("round-trips complete sources and freezes existing choices without mutation", () => {
    const source = filmSnapshot();
    const before = structuredClone(source);
    const frozen = withResolvedFilmPlan(source);
    const wire = filmPlanDocumentSchema.parse(
      JSON.parse(
        JSON.stringify({
          kind: "reel-studio-film-plan",
          version: 1,
          snapshot: frozen,
        }),
      ),
    );
    expect(filmPlanMatchesSource(wire.snapshot)).toBe(true);
    expect(wire.snapshot.filmPlan).toEqual(frozen.filmPlan);
    expect(source).toEqual(before);
    expect(wire.snapshot.script.scenes).toEqual(
      JSON.parse(JSON.stringify(source.script.scenes)),
    );
    expect(frozen.filmPlan!.shots.map((s) => s.sceneId)).toEqual([
      "legacy",
      "motion",
      "semantic",
    ]);
  });
  it("preserves old revision hashes and leaves legacy snapshots opt-in", () => {
    const old = filmSnapshot();
    expect(videoSnapshotSchema.parse(old).filmPlan).toBeUndefined();
    expect(videoRevisionHash(withResolvedFilmPlan(old))).toBe(
      videoRevisionHash(old),
    );
    expect(filmDigest({ a: 1, absent: undefined })).toBe(filmDigest({ a: 1 }));
    expect(filmDigest({ z: 2, a: 1 })).toBe(filmDigest({ a: 1, z: 2 }));
  });
  it.each(["text", "motion", "brand", "timing", "asset", "lock"])(
    "detects a changed %s dependency",
    (field) => {
      const snapshot = withResolvedFilmPlan(filmSnapshot());
      if (field === "text") snapshot.script.scenes[0].text = "Changed";
      if (field === "motion")
        snapshot.script.scenes[1].motion!.recipeId = "type-impact";
      if (field === "brand") snapshot.script.brandTokens.accent = "#ff0000";
      if (field === "timing") snapshot.script.fps = 24;
      if (field === "asset")
        snapshot.script.scenes[0].assetRefs = ["new-asset"];
      if (field === "lock") snapshot.script.scenes[1].locks!.scene = false;
      expect(filmPlanMatchesSource(snapshot)).toBe(false);
    },
  );
  it("rejects altered decisions and unsupported contract versions", () => {
    const snapshot = withResolvedFilmPlan(filmSnapshot());
    snapshot.filmPlan!.seed = "different";
    expect(filmPlanMatchesSource(snapshot)).toBe(false);
    expect(
      resolvedFilmPlanSchema.safeParse({
        ...snapshot.filmPlan,
        schemaVersion: 2,
      }).success,
    ).toBe(false);
    expect(
      resolvedFilmPlanSchema.safeParse({ ...snapshot.filmPlan, code: "run()" })
        .success,
    ).toBe(false);
  });
  it.each(["duplicate", "overlap", "missing-recipe", "overflow"])(
    "rejects %s shot graphs",
    (failure) => {
      const plan = resolveCompatibilityFilmPlan(filmSnapshot());
      if (failure === "duplicate")
        plan.shots[1].sceneId = plan.shots[0].sceneId;
      if (failure === "overlap") plan.shots[1].startFrame = 0;
      if (failure === "missing-recipe") plan.shots[0].recipe.id = "unknown";
      if (failure === "overflow")
        plan.shots[2].durationFrames = plan.timing.totalFrames;
      expect(resolvedFilmPlanSchema.safeParse(plan).success).toBe(false);
    },
  );
  it("rejects executable manifest extensions, duplicate ports and invalid ranges", () => {
    expect(
      adaptiveRecipeManifestSchema.safeParse({
        ...COMPATIBILITY_RECIPE,
        html: "<script>",
      }).success,
    ).toBe(false);
    expect(
      adaptiveRecipeManifestSchema.safeParse({
        ...COMPATIBILITY_RECIPE,
        durationSeconds: { min: 10, max: 1 },
      }).success,
    ).toBe(false);
    expect(
      adaptiveRecipeManifestSchema.safeParse({
        ...COMPATIBILITY_RECIPE,
        inputs: [
          ...COMPATIBILITY_RECIPE.inputs,
          ...COMPATIBILITY_RECIPE.inputs,
        ],
      }).success,
    ).toBe(false);
    expect(
      adaptiveRecipeManifestSchema.safeParse({
        ...COMPATIBILITY_RECIPE,
        fallback: [
          {
            id: COMPATIBILITY_RECIPE.id,
            version: COMPATIBILITY_RECIPE.version,
          },
        ],
      }).success,
    ).toBe(false);
  });
  it("distinguishes take, mixed, and stale timing, including cover offsets", () => {
    const snapshot = filmSnapshot();
    snapshot.script.coverUrl = "/media/cover.png";
    snapshot.take = {
      id: "take",
      scriptId: "script",
      label: null,
      providerId: "fixture",
      voiceId: "fixture",
      modelId: null,
      fps: 30,
      totalFrames: 90,
      timeline: [
        {
          sceneId: "legacy",
          startFrame: 0,
          durationFrames: 90,
          text: snapshot.script.scenes[0].text,
        },
      ],
      audioUrl: "/media/take.wav",
      isPlaceholder: false,
      source: "oneshot",
      createdAt: "2026-10-15T00:00:00.000Z",
    };
    expect(resolveCompatibilityFilmPlan(snapshot).timing).toMatchObject({
      source: "mixed",
      coverFrames: 45,
    });
    snapshot.script.scenes = snapshot.script.scenes.slice(0, 1);
    expect(resolveCompatibilityFilmPlan(snapshot).timing).toMatchObject({
      source: "take",
      totalFrames: 135,
    });
    snapshot.script.scenes[0].text = "New narration";
    expect(resolveCompatibilityFilmPlan(snapshot).timing.source).toBe(
      "estimated",
    );
  });
  it("bounds independently rounded 24fps beats to the existing export end", () => {
    const snapshot = filmSnapshot();
    snapshot.script.fps = 24;
    snapshot.script.scenes.forEach((scene) => {
      scene.text = "Short scene";
    });
    const plan = resolveCompatibilityFilmPlan(snapshot);
    const last = plan.shots.at(-1)!;
    expect(last.startFrame + last.durationFrames).toBe(
      plan.timing.contentFrames,
    );
    expect(plan.timing.contentFrames).toBe(101);
  });
  it("passes the captured catalog revision into composition preparation", () => {
    const snapshot = withResolvedFilmPlan(filmSnapshot());
    snapshot.filmPlan!.catalogRevision = "pinned-fixture-revision";
    const timing = resolveReelTimeline(
      snapshot.script.scenes,
      null,
      snapshot.script.fps,
    );
    expect(
      prepareVideoComposition(snapshot, timing).props.catalogRevision,
    ).toBe("pinned-fixture-revision");
  });
  it.each([
    [1080, 1920],
    [1920, 1080],
    [1080, 1080],
  ])("does not change compiled visuals at %sx%s", (width, height) => {
    const snapshot = filmSnapshot();
    snapshot.script.width = width;
    snapshot.script.height = height;
    const timing = resolveReelTimeline(
      snapshot.script.scenes,
      null,
      snapshot.script.fps,
    );
    const original = prepareVideoComposition(snapshot, timing);
    const frozen = prepareVideoComposition(
      withResolvedFilmPlan(snapshot),
      timing,
    );
    expect(frozen).toEqual(original);
    expect(buildHyperframesCompositionHtml(frozen.props)).toEqual(
      buildHyperframesCompositionHtml(original.props),
    );
  });
});
