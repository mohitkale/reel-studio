// @vitest-environment node
/**
 * Smoke test: renders a 3-second (90-frame) composition to a temp MP4.
 *
 * FIRST RUN: downloads a headless Chromium build (~170 MB). Subsequent runs
 * use the cached binary. Expect 1-3 minutes on first run.
 *
 * Set SKIP_RENDER_SMOKE=1 to skip in environments without a GPU/display.
 */

import { describe, it, expect } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";

const SKIP = process.env.SKIP_RENDER_SMOKE === "1";

describe.skipIf(SKIP)("render smoke", () => {
  it("renders a 3s reel composition to MP4 without errors", { timeout: 300_000 }, async () => {
      // Dynamic imports so the test file doesn't pull server deps into jsdom tests.
      const { bundle } = await import("@remotion/bundler");
      const { renderMedia, selectComposition } = await import("@remotion/renderer");

      const entryPoint = path.resolve(
        process.cwd(),
        "src/remotion/index.ts",
      );
      const outputPath = path.join(os.tmpdir(), `render-smoke-${Date.now()}.mp4`);

      // Bundle (cached on subsequent runs by OS tmpdir presence, not by this test).
      const serveUrl = await bundle({ entryPoint });

      const { defaultBrandTokens } = await import("@/compositions/tokens");

      const inputProps = {
        scenes: [
          { id: "s1", templateId: "kinetic", text: "Smoke test scene.", emphasis: ["Smoke test"] },
        ],
        timeline: [{ sceneId: "s1", startFrame: 0, durationFrames: 90 }],
        tokens: defaultBrandTokens,
      };

      const composition = await selectComposition({
        serveUrl,
        id: "Reel",
        inputProps,
      });

      await renderMedia({
        composition: { ...composition, durationInFrames: 90 },
        serveUrl,
        codec: "h264",
        outputLocation: outputPath,
        inputProps,
        imageFormat: "jpeg",
        pixelFormat: "yuv420p",
        logLevel: "error",
      });

      const stat = await fs.stat(outputPath);
      expect(stat.size).toBeGreaterThan(10_000); // non-empty MP4

      await fs.unlink(outputPath).catch(() => {});
  });
});
