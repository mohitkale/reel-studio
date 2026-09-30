/** Bounded native evidence proof; no providers or full-video renders. */
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { renderVisualReviewFrames } from "../src/library/visual-review";
import { defaultBrandTokens } from "../src/compositions/tokens";
import { motionDirection } from "../src/production/motion";
import { resolveProductionLayout } from "../src/production/layout";
import type { LayoutEvidence } from "../src/production/visual-review-layout";

async function main() {
  const output = path.resolve(".artifacts", `review-layout-${Date.now()}`);
  const report: unknown[] = [];
  for (const [name, width, height] of [
    ["portrait", 1080, 1920],
    ["landscape", 1920, 1080],
    ["square", 1080, 1080],
  ] as const) {
    for (const overflow of [false, true]) {
      const evidence: LayoutEvidence[] = [];
      const layout = resolveProductionLayout({ width, height });
      // Intentional failure fixture: shrink content safe area until authored copy overflows.
      if (overflow) layout.safeArea.left = width - 100;
      const props = {
        scenes: [
          {
            id: "scene",
            order: 0,
            templateId: "kinetic",
            text: "Grow with care",
            emphasis: [],
            motion: motionDirection("type-impact"),
          },
        ],
        timeline: [{ sceneId: "scene", startFrame: 0, durationFrames: 90 }],
        tokens: defaultBrandTokens,
        width,
        height,
        fps: 30,
        layout,
        hideProgressBar: true,
      };
      const paths = await renderVisualReviewFrames(
        "remotion",
        props,
        90,
        [58],
        path.join(output, `${name}-${overflow ? "overflow" : "clean"}`),
        "http://127.0.0.1:9999",
        undefined,
        (value) => evidence.push(value),
      );
      assert.equal(evidence.length, 1);
      assert.ok(evidence[0].checkedTextNodes > 0);
      assert.equal(
        evidence[0].issues.length > 0,
        overflow,
        JSON.stringify(evidence),
      );
      if (name === "portrait" && !overflow) {
        const plain = await renderVisualReviewFrames(
          "remotion",
          props,
          90,
          [58],
          path.join(output, "plain"),
          "http://127.0.0.1:9999",
        );
        assert.deepEqual(
          await sharp(paths[0]).raw().toBuffer(),
          await sharp(plain[0]).raw().toBuffer(),
          "Layout measurement changed rendered pixels",
        );
      }
      report.push({ name, overflow, evidence });
    }
  }
  await fs.writeFile(
    path.join(output, "result.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(output);
}
void main();
