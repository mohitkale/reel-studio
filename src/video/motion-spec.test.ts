import { describe, expect, it } from "vitest";
import { graphFixture } from "../../tests/fixtures/motion-graph";
import {
  legacyMotionRoundTrip,
  migrateLegacyMotion,
  motionSpecSchema,
} from "./motion-spec";
import { defaultBrandTokens } from "./tokens";
import type { ReelProps } from "./types";
import { buildHyperframesCompositionHtml } from "@/engines/hyperframes/build-composition";

const props: ReelProps = {
  fps: 30,
  width: 540,
  height: 960,
  tokens: defaultBrandTokens,
  scenes: [
    {
      id: "source",
      templateId: "hf-statement",
      text: "Every word survives.",
      emphasis: ["word"],
      visual: "★",
      background: {
        type: "image",
        url: "/media/photo.png",
        effect: "pan-left",
      },
      items: ["One", "Two"],
      chart: { labels: ["A"], series: [{ label: "Given", values: [42] }] },
      hideText: false,
      role: "headline",
      mood: "calm",
      order: 2,
    },
  ],
  timeline: [{ sceneId: "source", startFrame: 0, durationFrames: 90 }],
};
describe("versioned motion graph", () => {
  it("allocates migration IDs without colliding with saved scene IDs", () => {
    const collision = {
      ...props,
      scenes: [{ ...props.scenes[0], id: "legacy-layer-0" }],
      timeline: [{ ...props.timeline[0], sceneId: "legacy-layer-0" }],
    };
    expect(
      legacyMotionRoundTrip(migrateLegacyMotion(collision), collision.scenes),
    ).toEqual({ scenes: collision.scenes, timeline: collision.timeline });
    expect(() => migrateLegacyMotion({ ...props, scenes: [] })).toThrow(
      "Missing",
    );
  });
  it("round trips every legacy scene field and exact beat timing without mutating the source", () => {
    const migrated = migrateLegacyMotion(props);
    const restored = legacyMotionRoundTrip(migrated, props.scenes);
    expect(restored).toEqual({
      scenes: props.scenes,
      timeline: props.timeline,
    });
    restored.scenes[0].text = "Edited";
    expect(props.scenes[0].text).toBe("Every word survives.");
    expect(
      buildHyperframesCompositionHtml({ ...props, motionSpec: migrated }),
    ).toBe(buildHyperframesCompositionHtml(props));
  });
  it("rejects missing references and unsupported versions instead of dropping content", () => {
    expect(() => legacyMotionRoundTrip(migrateLegacyMotion(props), [])).toThrow(
      "Missing",
    );
    expect(
      motionSpecSchema.safeParse({ ...migrateLegacyMotion(props), version: 2 })
        .success,
    ).toBe(false);
  });
  it("rejects overlapping shots, duplicate ids, unbounded boxes, unsafe properties and unordered/out-of-window keys", () => {
    const spec = graphFixture().motionSpec!;
    expect(
      motionSpecSchema.safeParse({
        ...spec,
        shots: [...spec.shots, spec.shots[0]],
      }).success,
    ).toBe(false);
    const mutate = (change: (spec: Record<string, unknown>) => void) => {
      const copy = JSON.parse(JSON.stringify(spec));
      change(copy);
      return motionSpecSchema.safeParse(copy).success;
    };
    expect(
      mutate((copy) => {
        copy.shots = [
          {
            ...spec.shots[0],
            layers: [
              {
                id: "bad",
                order: 0,
                elements: [
                  {
                    ...spec.shots[0].layers[0].elements[0],
                    box: { x: 0.9, y: 0, width: 0.3, height: 1 },
                  },
                ],
              },
            ],
          },
        ];
      }),
    ).toBe(false);
    for (const tracks of [
      [{ property: "innerHTML", keyframes: [{ frame: 0, value: 1 }] }],
      [
        {
          property: "x",
          keyframes: [
            { frame: 12, value: 0 },
            { frame: 0, value: 10 },
          ],
        },
      ],
      [{ property: "x", keyframes: [{ frame: 100, value: 0 }] }],
      [{ property: "opacity", keyframes: [{ frame: 0, value: 2 }] }],
    ])
      expect(
        mutate((copy) => {
          copy.shots = [
            {
              ...spec.shots[0],
              layers: [
                {
                  id: "bad",
                  order: 0,
                  elements: [
                    { ...spec.shots[0].layers[0].elements[0], tracks },
                  ],
                },
              ],
            },
          ];
        }),
      ).toBe(false);
  });
  it("compiles ordered layers deterministically and escapes authored text", () => {
    const fixture = graphFixture();
    const spec = fixture.motionSpec!;
    const text = spec.shots[0].layers[1].elements[0];
    if (text.kind === "text") text.text = '<script>alert("x")</script>';
    const html = buildHyperframesCompositionHtml(fixture);
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html.indexOf('data-motion-layer="decor"')).toBeLessThan(
      html.indexOf('data-motion-layer="copy"'),
    );
    expect(html).toBe(buildHyperframesCompositionHtml(fixture));
    expect(() => legacyMotionRoundTrip(spec, fixture.scenes)).toThrow(
      "Authored graph",
    );
    expect(() =>
      buildHyperframesCompositionHtml({ ...fixture, fps: 24 }),
    ).toThrow("match reel timing");
  });
});
