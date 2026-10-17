import { LEGACY_CAPTION_STYLE } from "@/lib/caption-style";
import { expect, it } from "vitest";
import { filmSnapshot } from "../../tests/fixtures/film-plan";
import { deriveFactorySnapshot } from "./factory-derive";
import {
  factoryRunRequestSchema,
  factoryProfileDocumentSchema,
  factoryDesignSchema,
} from "./factory";
import { withResolvedFilmPlan, filmPlanMatchesSource } from "./film-plan";

function source() {
  const initial = filmSnapshot();
  const first = initial.script.scenes[0];
  initial.script.scenes = Array.from({ length: 4 }, (_, order) => ({
    ...structuredClone(first),
    id: `scene-${order}`,
    order,
    text: `Saved source ${order}`,
    spokenText: `Complete supplied narration ${order}`,
  }));
  initial.take = null;
  initial.script.chapterPlan = undefined;
  initial.script.chapterDraft = undefined;
  return initial;
}
it("reflows full stories without changing copy, narration, locks, registry or source", () => {
  const original = withResolvedFilmPlan(source()),
    before = structuredClone(original);
  const result = deriveFactorySnapshot(original, {
    kind: "aspect",
    key: "square",
    label: "Square",
    orientation: "square",
  }).finalize();
  expect(result.script.width).toBe(result.script.height);
  expect(result.script.scenes).toEqual(original.script.scenes);
  expect(result.script.motionPlan).toEqual(original.script.motionPlan);
  expect(original).toEqual(before);
  expect(filmPlanMatchesSource(result)).toBe(true);
});
it("creates an explicit cutdown selection in source order and rejects lost caption copy", () => {
  const original = source(),
    ids = original.script.scenes.map((scene) => scene.id);
  const result = deriveFactorySnapshot(original, {
    kind: "cutdown",
    key: "short",
    label: "Short",
    orientation: "portrait",
    sceneIds: [ids[0], ids[2]],
  });
  expect(result.snapshot.script.scenes.map((scene) => scene.text)).toEqual([
    "Saved source 0",
    "Saved source 2",
  ]);
  expect(result.ranges).toHaveLength(2);
  expect(result.ranges[1].outputStart).toBe(result.ranges[0].endFrame);
  expect(() =>
    deriveFactorySnapshot(original, {
      kind: "cutdown",
      key: "short",
      label: "Short",
      orientation: "portrait",
      sceneIds: [ids[2], ids[0]],
    }),
  ).toThrow(/original order/);
  expect(() =>
    deriveFactorySnapshot(original, {
      kind: "cutdown",
      key: "short",
      label: "Short",
      orientation: "portrait",
      sceneIds: ids,
    }),
  ).toThrow(/remove at least one/);
  original.script.captionTracks = [
    {
      id: "captions",
      scriptId: original.script.id,
      label: "Source",
      language: "en",
      timingSource: "estimated",
      enabled: true,
      style: LEGACY_CAPTION_STYLE,
      updatedAt: "now",
      cues: [
        {
          id: "cue",
          order: 0,
          startFrame: 0,
          endFrame: 100000,
          text: "A caption crossing removed material",
        },
      ],
    },
  ];
  expect(() =>
    deriveFactorySnapshot(original, {
      kind: "cutdown",
      key: "short",
      label: "Short",
      orientation: "portrait",
      sceneIds: [ids[0]],
    }),
  ).toThrow(/caption crosses/);
});
it("uses versioned series defaults without overwriting whole-scene locks", () => {
  const original = source();
  original.script.scenes[0].locks = { copy: true, assets: true, scene: true };
  const profile = factoryProfileDocumentSchema.parse({
    schemaVersion: 1,
    key: "series",
    version: 1,
    name: "Series",
    sourceRevisionId: "revision",
    orientations: ["square"],
    quality: "draft",
    packDigest: `sha256:${"a".repeat(64)}`,
    design: { ...factoryDesignSchema.parse(original.script), energy: "high" },
  });
  expect(() =>
    deriveFactorySnapshot(
      original,
      { kind: "aspect", key: "square", label: "Square", orientation: "square" },
      profile,
    ),
  ).toThrow(/Whole-scene locks/);
  expect(() =>
    factoryRunRequestSchema.parse({
      idempotencyKey: "factory-test",
      sourceRevisionId: "source",
      variants: Array(7).fill({
        kind: "aspect",
        key: "same",
        label: "Same",
        orientation: "square",
      }),
    }),
  ).toThrow();
});
