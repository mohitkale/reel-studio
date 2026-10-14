import { expect, it } from "vitest";
import { SHOWPIECE_SAMPLES } from "@/video/showpiece-samples";
import { buildAutomaticSfxCues } from "./sfx-planner";
import { resolveReelSfxCues, parseSfxState } from "./sfx-cues";
import { getSfxClip } from "./sfx-library";
const scene = {
  ...SHOWPIECE_SAMPLES[4],
  scriptId: "fixture",
  order: 0,
  spokenText: SHOWPIECE_SAMPLES[4].spokenText!,
  hideText: null,
  selectedVoiceClipId: null,
};
const cues = buildAutomaticSfxCues([scene]);
const args = {
  sfxEnabled: true,
  sfxJson: JSON.stringify({ enabled: true, cues }),
  scenes: [scene],
  timeline: [{ sceneId: scene.id, startFrame: 120, durationFrames: 240 }],
  fps: 30,
  videoEngine: "hyperframes" as const,
  spokenWords: [
    { text: "Designer", startFrame: 150, endFrame: 170 },
    { text: "Reviewer", startFrame: 240, endFrame: 260 },
    { text: "DevOps", startFrame: 300, endFrame: 320 },
  ],
};
it("lands sparse sound peaks on the same measured subject action as picture, quietly under narration", () => {
  expect(cues).toHaveLength(2);
  expect(parseSfxState(args.sfxJson).cues).toEqual(cues);
  const resolved = resolveReelSfxCues(args);
  expect(resolved).toHaveLength(2);
  const pop = getSfxClip("pop")!;
  expect(resolved[0].startFrame + Math.round(pop.peakOffsetSeconds * 30)).toBe(
    240,
  );
  expect(resolved[0].volume).toBeCloseTo(0.06 * 0.35);
  expect(
    resolved.every(
      (cue) =>
        cue.volume <= 0.08 && cue.startFrame >= 120 && cue.startFrame < 360,
    ),
  ).toBe(true);
  expect(resolveReelSfxCues({ ...args, sfxEnabled: false })).toEqual([]);
  expect(
    resolveReelSfxCues({
      ...args,
      scenes: [{ ...scene, spokenText: "Different words." }],
    }),
  ).toEqual([]);
});
it("preserves authored sound and suppresses conflicting automatic accents", () => {
  const manual = {
    sceneId: scene.id,
    sfxId: "pop",
    offsetSeconds: 4,
    volume: 0.4,
    source: "manual",
  };
  const resolved = resolveReelSfxCues({
    ...args,
    sfxJson: JSON.stringify({ enabled: true, cues: [manual, ...cues] }),
  });
  expect(resolved.find((cue) => cue.startFrame === 240)?.volume).toBe(0.4);
  expect(resolved.filter((cue) => cue.startFrame === 240)).toHaveLength(1);
});
