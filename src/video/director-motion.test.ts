import { expect, it } from "vitest";
import { compileDirectorMotion } from "./director-motion";
import { defaultBrandTokens } from "./tokens";
import type { ReelProps } from "./types";

const props: ReelProps = {
  tokens: defaultBrandTokens,
  width: 540,
  height: 960,
  fps: 30,
  scenes: [
    {
      id: "quote",
      templateId: "hf-quote",
      text: "Keep every supplied word.",
      emphasis: [],
      direction: { version: 1, role: "quote", composition: "layered-title" },
    },
  ],
  timeline: [{ sceneId: "quote", startFrame: 30, durationFrames: 90 }],
  spokenWords: [{ startFrame: 45, endFrame: 55 }],
};
it("rebases graph entrances on the current beat and measured narration", () => {
  const first = compileDirectorMotion(props)!;
  const text = first.shots[0].layers[0].elements[1];
  expect(first.shots[0]).toMatchObject({ startFrame: 30, durationFrames: 90 });
  expect(text).toMatchObject({
    kind: "text",
    text: "Keep every supplied word.",
    tracks: [
      {
        property: "opacity",
        keyframes: [
          { frame: 0, value: 0 },
          { frame: 15, value: 0 },
          { frame: 26, value: 1 },
        ],
      },
    ],
  });
  const changed = compileDirectorMotion({
    ...props,
    fps: 24,
    spokenWords: [],
    timeline: [{ sceneId: "quote", startFrame: 0, durationFrames: 48 }],
  })!;
  expect(changed.shots[0].layers[0].elements[1]).toMatchObject({
    tracks: [{ keyframes: [{ frame: 0 }, { frame: 8 }] }],
  });
  expect(compileDirectorMotion(props)).toEqual(first);
});
it("falls back without discarding media, chart data, hidden or overbudget copy", () => {
  for (const update of [
    { background: { type: "image" as const, url: "/media/local.png" } },
    { hideText: true },
    { text: "Complete words ".repeat(30) },
  ]) {
    const compiled = compileDirectorMotion({
      ...props,
      scenes: [{ ...props.scenes[0], ...update }],
    })!;
    expect(compiled.shots[0].layers[0].elements[0].kind).toBe("legacy-scene");
  }
});
