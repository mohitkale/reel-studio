import { describe, expect, it } from "vitest";
import type { SceneDTO } from "@/lib/dto";
import { parseSfxState, resolveReelSfxCues } from "@/lib/sfx-cues";
import { motionDirection } from "@/production/motion";
import type { SfxCue } from "@/lib/sfx-library";

const scene: SceneDTO = {
  id: "scene",
  scriptId: "script",
  order: 0,
  templateId: "hf-kinetic-slam",
  text: "A clear hit",
  spokenText: null,
  emphasis: [],
  hideText: null,
  selectedVoiceClipId: null,
  role: "hook",
  motion: motionDirection("type-impact"),
};
const event: SfxCue = {
  sceneId: "scene",
  sfxId: "soft-hit",
  offsetSeconds: 0,
  volume: 0.14,
  source: "automatic",
  event: { ...motionDirection("type-impact"), anchor: "impact" },
};
function resolve(
  cues: SfxCue[],
  extra: Partial<Parameters<typeof resolveReelSfxCues>[0]> = {},
) {
  return resolveReelSfxCues({
    sfxEnabled: true,
    sfxJson: JSON.stringify({ enabled: true, cues }),
    fps: 30,
    videoEngine: "hyperframes",
    scenes: [scene],
    timeline: [{ sceneId: "scene", startFrame: 90, durationFrames: 90 }],
    ...extra,
  });
}

describe("event sound timing", () => {
  it("aligns the audible peak to an engine's authored landmark and follows retiming", () => {
    // HF impact at .58s, soft hit RMS peak at .005s: clip begins at frame 17.
    expect(resolve([event])[0].startFrame).toBe(107);
    expect(resolve([event], { videoEngine: "remotion" })[0].startFrame).toBe(
      107,
    );
    expect(resolve([event], { fps: 60 })[0].startFrame).toBe(125);
    expect(
      resolve([event], { fps: 60, videoEngine: "remotion" })[0].startFrame,
    ).toBe(107);
    expect(
      resolve([event], {
        timeline: [{ sceneId: "scene", startFrame: 180, durationFrames: 90 }],
      })[0].startFrame,
    ).toBe(197);
  });

  it("compensates for a long sweep's peak, with manual trims relative to the anchor", () => {
    expect(resolve([{ ...event, sfxId: "whoosh" }])[0].startFrame).toBe(97);
    expect(
      resolve([
        { ...event, sfxId: "whoosh", offsetSeconds: 0.1, source: "manual" },
      ])[0].startFrame,
    ).toBe(100);
  });

  it("drops stale, hidden or incompatible events instead of playing the wrong treatment", () => {
    expect(
      resolve([event], {
        scenes: [{ ...scene, motion: motionDirection("type-editorial") }],
      }),
    ).toEqual([]);
    expect(
      resolve([event], { scenes: [{ ...scene, text: "x".repeat(121) }] }),
    ).toEqual([]);
    expect(resolve([event], { hideText: true })).toEqual([]);
    expect(resolve([event], { videoEngine: undefined })).toEqual([]);
    expect(resolve([event], { sfxEnabled: false })).toEqual([]);
    expect(
      resolve([event], {
        hideText: true,
        scenes: [{ ...scene, hideText: false }],
      }),
    ).toHaveLength(1);
  });

  it("keeps legacy offsets and explicit zero gain intact", () => {
    const manual = {
      sceneId: "scene",
      sfxId: "click" as const,
      offsetSeconds: 0.12,
      volume: 0.4,
    };
    expect(resolve([manual])[0]).toEqual({
      url: "/sfx/click.wav",
      startFrame: 94,
      volume: 0.4,
    });
    expect(
      parseSfxState(JSON.stringify({ cues: [{ ...manual, volume: 0 }] }))
        .cues[0].volume,
    ).toBe(0);
    expect(resolve([{ ...manual, volume: 0 }])).toEqual([]);
    expect(parseSfxState('{"enabled":false,"cues":[]}').enabled).toBe(false);
    expect(
      parseSfxState('{"cues":[null,{"sceneId":"scene","sfxId":"unknown"}]}')
        .cues,
    ).toEqual([]);
  });

  it("keeps automatic clips inside their scene and prevents overlap with creator cues", () => {
    expect(
      resolve([event], {
        timeline: [{ sceneId: "scene", startFrame: 0, durationFrames: 24 }],
      }),
    ).toEqual([]);
    expect(
      resolve([
        event,
        { sceneId: "scene", sfxId: "swipe", volume: 0.2, offsetSeconds: 0.5 },
      ]),
    ).toEqual([{ url: "/sfx/swipe.wav", startFrame: 105, volume: 0.2 }]);
    expect(
      resolve([
        {
          ...event,
          sfxId: "riser",
          event: { ...event.event!, anchor: "reveal" },
        },
      ]),
    ).toEqual([]);
  });

  it("limits automatic accents even when short scene boundaries don't overlap", () => {
    const second = { ...scene, id: "second" };
    expect(
      resolve([event, { ...event, sceneId: "second" }], {
        scenes: [scene, second],
        timeline: [
          { sceneId: "scene", startFrame: 0, durationFrames: 40 },
          { sceneId: "second", startFrame: 40, durationFrames: 60 },
        ],
      }),
    ).toHaveLength(1);
  });

  it("never passes invalid numeric input to the renderers", () => {
    expect(resolve([event], { fps: 0 })).toEqual([]);
    expect(
      parseSfxState(
        JSON.stringify({
          cues: [{ ...event, volume: "bad", offsetSeconds: "Infinity" }],
        }),
      ).cues[0],
    ).toMatchObject({ volume: 0.35, offsetSeconds: 0 });
  });
});
