import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { storyboardToReelProps } from "@/production/storyboard-reel";
import { lintStoryboard } from "@/storyboard/lint";
import { buildHyperframesCompositionHtml } from "./build-composition";

const dir = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "examples",
  "storyboards",
);
const videos = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => ({
    name: f,
    sb: lintStoryboard(readFileSync(path.join(dir, f), "utf8")).storyboard,
  }))
  .filter((e) => e.sb?.kind === "video");

describe("the golden set under the variety engine", () => {
  it.each(videos.map((v) => [v.name, v.sb] as const))(
    "%s has camera moves and a varied look",
    (_name, sb) => {
      const html = buildHyperframesCompositionHtml(
        storyboardToReelProps(sb!).props,
      );
      const cameras = [
        ...html.matchAll(/data-camera="(push-in|pull-out|pan)"/g),
      ];
      expect(cameras.length).toBeGreaterThanOrEqual(2);
      const layouts = new Set(
        [...html.matchAll(/data-layout="(\w+)"/g)].map((m) => m[1]),
      );
      expect(layouts.size).toBeGreaterThanOrEqual(2);
    },
  );

  it("resolves the same plan for the same storyboard", () => {
    const sb = videos[0]!.sb!;
    const a = buildHyperframesCompositionHtml(storyboardToReelProps(sb).props);
    const b = buildHyperframesCompositionHtml(storyboardToReelProps(sb).props);
    expect(a).toBe(b);
  });
});
