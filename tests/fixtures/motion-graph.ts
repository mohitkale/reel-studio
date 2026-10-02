import { motionSpecSchema } from "../../src/video/motion-spec";
import { defaultBrandTokens } from "../../src/video/tokens";
import type { ReelProps } from "../../src/video/types";

export function graphFixture(): ReelProps {
  return {
    fps: 30,
    width: 540,
    height: 960,
    tokens: defaultBrandTokens,
    timeline: [
      { sceneId: "source", startFrame: 0, durationFrames: 90 },
      { sceneId: "legacy", startFrame: 90, durationFrames: 60 },
    ],
    scenes: [
      {
        id: "source",
        templateId: "hf-statement",
        text: "Compose with intent.",
        emphasis: [],
      },
      {
        id: "legacy",
        templateId: "hf-statement",
        text: "Keep existing stories.",
        emphasis: [],
      },
    ],
    motionSpec: motionSpecSchema.parse({
      version: 1,
      fps: 30,
      shots: [
        {
          id: "source",
          startFrame: 0,
          durationFrames: 90,
          layers: [
            {
              id: "decor",
              order: 0,
              elements: [
                {
                  id: "orb",
                  kind: "shape",
                  shape: "ellipse",
                  box: { x: 0.12, y: 0.16, width: 0.3, height: 0.3 },
                  color: "accent",
                  tracks: [
                    {
                      property: "x",
                      keyframes: [
                        { frame: 0, value: 0 },
                        { frame: 90, value: 90, ease: "in-out" },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              id: "copy",
              order: 1,
              elements: [
                {
                  id: "headline",
                  kind: "text",
                  text: "Compose with intent.",
                  box: { x: 0.1, y: 0.45, width: 0.8, height: 0.25 },
                  color: "foreground",
                  fontSize: 46,
                  align: "left",
                  tracks: [
                    {
                      property: "opacity",
                      keyframes: [
                        { frame: 0, value: 0 },
                        { frame: 18, value: 1, ease: "out" },
                      ],
                    },
                    {
                      property: "y",
                      keyframes: [
                        { frame: 0, value: 36 },
                        { frame: 18, value: 0, ease: "out" },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: "legacy",
          startFrame: 90,
          durationFrames: 60,
          layers: [
            {
              id: "legacy-layer",
              order: 0,
              elements: [
                {
                  id: "legacy-content",
                  kind: "legacy-scene",
                  sceneId: "legacy",
                },
              ],
            },
          ],
        },
      ],
    }),
  };
}
