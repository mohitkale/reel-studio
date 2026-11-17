import { describe, expect, it } from "vitest";

import { preparedVideoCompositionSchema } from "./video-snapshot";

const base = {
  totalFrames: 90,
  props: {
    scenes: [
      {
        id: "s1",
        templateId: "hf-steps",
        text: "How to start",
        emphasis: [],
        order: 0,
        panel: {
          items: ["Pick one goal", "Block the time"],
          illustration: "stars-2",
          sceneType: "steps",
        },
      },
    ],
    timeline: [{ sceneId: "s1", startFrame: 0, durationFrames: 90 }],
    width: 1080,
    height: 1920,
    fps: 30,
    tokens: {
      background: "#000000",
      backgroundAccent: "#111111",
      foreground: "#ffffff",
      muted: "#999999",
      accent: "#ff0000",
      accentSecondary: "#00ff00",
      handle: "@reel",
      accentForeground: "#ffffff",
      fontFamily: "Inter",
      radius: 12,
    },
  },
};

describe("preparedVideoCompositionSchema", () => {
  it("keeps a scene's panel data (steps, diagram, illustration, ...) for the export", () => {
    const parsed = preparedVideoCompositionSchema.safeParse(base);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.props.scenes[0]!.panel).toEqual(
      base.props.scenes[0]!.panel,
    );
  });
});
