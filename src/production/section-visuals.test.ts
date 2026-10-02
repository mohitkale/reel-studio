import { expect, it } from "vitest";
import { sectionVisualProps } from "./section-visuals";
import type { ReelProps } from "@/video/types";
import { serverDefaultTokens } from "@/lib/brand-defaults";

const props: ReelProps = {
  scenes: [
    { id: "a", templateId: "hook", text: "Opening", emphasis: [], order: 0 },
    {
      id: "b",
      templateId: "hook",
      text: "Next chapter",
      emphasis: [],
      order: 1,
    },
  ],
  timeline: [
    { sceneId: "a", startFrame: 0, durationFrames: 90 },
    { sceneId: "b", startFrame: 120, durationFrames: 90 },
  ],
  audioUrl: "/media/voice.wav",
  musicUrl: "/music/bed.wav",
  tokens: serverDefaultTokens,
  captions: {
    enabled: true,
    timingSource: "imported",
    cues: [
      { id: "a", startFrame: 0, endFrame: 120, text: "Opening caption" },
      { id: "b", startFrame: 120, endFrame: 210, text: "Next caption" },
    ],
  },
};
it("includes outgoing holds, crossing boundaries and cover offsets without retiming", () => {
  const held = sectionVisualProps(
    props,
    { index: 0, startFrame: 90, endFrame: 119 },
    30,
  );
  expect(held.scenes.map((scene) => scene.id)).toEqual(["a"]);
  expect(held.timeline).toEqual(props.timeline);
  expect(held.audioUrl).toBeUndefined();
  expect(held.musicUrl).toBeUndefined();
  expect(held.captions?.cues.map((cue) => cue.id)).toEqual(["a"]);
  expect(
    sectionVisualProps(props, { index: 1, startFrame: 119, endFrame: 121 }, 30)
      .scenes,
  ).toEqual(props.scenes);
  expect(
    sectionVisualProps(
      { ...props, coverUrl: "/media/cover.png" },
      { index: 0, startFrame: 0, endFrame: 44 },
      30,
    ).scenes,
  ).toEqual([]);
  expect(
    sectionVisualProps(
      { ...props, coverUrl: "/media/cover.png" },
      { index: 1, startFrame: 165, endFrame: 180 },
      30,
    ).scenes.map((scene) => scene.id),
  ).toEqual(["b"]);
});
it("keeps unrelated visual edits out of a section while invalidating affected scenes, captions and shared direction", () => {
  const section = { index: 0, startFrame: 0, endFrame: 119 };
  const changed = structuredClone(props);
  changed.scenes[1].text = "Revised later chapter";
  changed.captions!.cues[1].text = "Revised later caption";
  changed.audioUrl = "/media/other.wav";
  expect(sectionVisualProps(changed, section, 30)).toEqual(
    sectionVisualProps(props, section, 30),
  );
  changed.scenes[0].text = "Revised opening";
  expect(sectionVisualProps(changed, section, 30)).not.toEqual(
    sectionVisualProps(props, section, 30),
  );
});
