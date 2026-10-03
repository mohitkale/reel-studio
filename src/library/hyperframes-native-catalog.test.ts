// @vitest-environment node
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { defaultBrandTokens } from "@/video/tokens";
import { writeHyperframesReviewProject } from "./hyperframes-render";

it("stages the real native catalog adapter without unused upstream data compositions", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "reel-native-catalog-"));
  try {
    await writeHyperframesReviewProject(
      directory,
      {
        width: 540,
        height: 960,
        fps: 30,
        tokens: defaultBrandTokens,
        scenes: [
          {
            id: "kinetic",
            templateId: "hf-kinetic-slam",
            text: "Shared helper preserved.",
            emphasis: [],
          },
          {
            id: "metric",
            templateId: "hf-money-count",
            text: "Supplied completion.",
            visual: "72%",
            emphasis: [],
          },
        ],
        timeline: [
          { sceneId: "metric", startFrame: 0, durationFrames: 120 },
          { sceneId: "kinetic", startFrame: 120, durationFrames: 120 },
        ],
      },
      "http://127.0.0.1:3000",
    );
    expect(await readdir(path.join(directory, "compositions"))).toEqual([
      "caption-kinetic-slam--kinetic.html",
    ]);
    expect(
      await readFile(path.join(directory, "index.html"), "utf8"),
    ).toContain("72%");
    expect(
      await readFile(path.join(directory, "index.html"), "utf8"),
    ).not.toContain('data-composition-src="compositions/apple-money-count');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
