// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildHyperframesCompositionHtml } from "@/engines/hyperframes/build-composition";
import { resolveProductionLayout } from "@/production/layout";
import { lintStoryboard } from "@/storyboard";

import { storyboardToReelProps } from "./storyboard-reel";

const storyboard = lintStoryboard({
  version: 1,
  title: "T",
  format: "9:16",
  scenes: [
    {
      type: "hook",
      headline: "Stop scrolling now",
      narration: "A hook worth hearing today.",
    },
    {
      type: "list",
      headline: "Three habits",
      narration: "Here are three habits to try.",
      items: ["Same bedtime", "Dim the lights", "Phone away"],
    },
    {
      type: "cta",
      headline: "Try it",
      narration: "Try it tonight, it is free.",
    },
  ],
}).storyboard!;

describe("storyboardToReelProps", () => {
  it("builds the same scenes production would, with estimated timing and captions", () => {
    const { props, spans } = storyboardToReelProps(storyboard);
    expect(props.scenes.map((s) => s.templateId)).toEqual([
      "hf-opener",
      "hf-list",
      "hf-cta",
    ]);
    expect(props.scenes[1]!.items).toEqual([
      "Same bedtime",
      "Dim the lights",
      "Phone away",
    ]);
    expect(props.width).toBe(1080);
    expect(props.height).toBe(1920);
    expect(spans).toHaveLength(3);
    expect(spans[1]!.startFrame).toBeGreaterThanOrEqual(spans[0]!.endFrame);
    expect(props.captions?.cues.length).toBeGreaterThan(2);
  });

  it("compiles, with every supplied list item and no internal role names on screen", () => {
    const html = buildHyperframesCompositionHtml(
      storyboardToReelProps(storyboard).props,
    );
    for (const item of ["Same bedtime", "Dim the lights", "Phone away"])
      expect(html).toContain(item);
    expect(html).not.toMatch(
      /class="fx-chip"[^>]*>\s*(summary|hook|cta|feature)\s*</i,
    );
  });

  it("is deterministic", () => {
    expect(storyboardToReelProps(storyboard).props).toEqual(
      storyboardToReelProps(storyboard).props,
    );
  });
});

describe("platform safe areas", () => {
  it("keeps the bottom 18% and right 12% of a vertical frame clear", () => {
    const { safeArea } = resolveProductionLayout({ width: 1080, height: 1920 });
    expect(safeArea.bottom).toBe(Math.round(1920 * 0.18));
    expect(safeArea.right).toBe(Math.round(1080 * 0.12));
    expect(safeArea.left).toBeLessThan(safeArea.right);
  });

  it("leaves landscape and square symmetric", () => {
    const wide = resolveProductionLayout({
      width: 1920,
      height: 1080,
    }).safeArea;
    expect(wide.left).toBe(wide.right);
    const square = resolveProductionLayout({
      width: 1080,
      height: 1080,
    }).safeArea;
    expect(square.left).toBe(square.right);
  });
});
