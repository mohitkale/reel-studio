import { describe, expect, it } from "vitest";

import { storyboardToReelProps } from "@/production/storyboard-reel";
import { lintStoryboard } from "@/storyboard/lint";
import { buildHyperframesCompositionHtml } from "./build-composition";
import { draftFps } from "@/library/hyperframes-render";

const { props } = storyboardToReelProps(
  lintStoryboard({
    version: 1,
    title: "Draft",
    format: "9:16",
    scenes: [
      {
        type: "statement",
        headline: "One idea",
        narration: "One idea, said plainly for everyone.",
      },
    ],
  }).storyboard!,
);

describe("draft capture", () => {
  it("scales the whole layout and shrinks only the capture canvas", () => {
    const html = buildHyperframesCompositionHtml(props, {
      producerMode: true,
      draftScale: 0.5,
    });
    expect(html).toContain('data-width="540"');
    expect(html).toContain('data-height="960"');
    expect(html).toContain(
      "transform:scale(0.5);transform-origin:0 0;width:1080px;height:1920px",
    );
  });

  it("leaves a normal render and the editor preview untouched", () => {
    expect(
      buildHyperframesCompositionHtml(props, { producerMode: true }),
    ).toContain('data-width="1080"');
    const preview = buildHyperframesCompositionHtml(props, { draftScale: 0.5 });
    expect(preview).toContain('data-width="1080"');
    expect(preview).not.toContain("data-draft-scale");
  });

  it("halves the frame rate of a draft only when it stays at 12 fps or more", () => {
    expect(draftFps(30, "draft")).toBe(15);
    expect(draftFps(24, "draft")).toBe(12);
    expect(draftFps(30, "standard")).toBe(30);
    expect(draftFps(20, "draft")).toBe(20);
  });
});
