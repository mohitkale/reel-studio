/** Bounded native evidence proof; no providers or full-video renders. */
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { renderVisualReviewFrames } from "../src/library/visual-review";
import { defaultBrandTokens } from "../src/compositions/tokens";
import { motionDirection } from "../src/production/motion";
import { resolveProductionLayout } from "../src/production/layout";
import type { LayoutEvidence } from "../src/production/visual-review-layout";

async function main() {
  const output = path.resolve(".artifacts", `review-layout-${Date.now()}`);
  const report: unknown[] = [];
  for (const engine of ["remotion", "hyperframes"] as const) {
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
              motion: {
                ...motionDirection("type-impact"),
                typeEntrance: "sweep" as const,
              },
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
          engine,
          props,
          90,
          [58],
          path.join(
            output,
            `${engine}-${name}-${overflow ? "overflow" : "clean"}`,
          ),
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
            engine,
            props,
            90,
            [58],
            path.join(output, `${engine}-plain`),
            "http://127.0.0.1:9999",
          );
          const hash = async (file: string) =>
            createHash("sha256")
              .update(await sharp(file).raw().toBuffer())
              .digest("hex");
          assert.equal(
            await hash(paths[0]),
            await hash(plain[0]),
            "Layout measurement changed rendered pixels",
          );
        }
        report.push({ engine, name, overflow, evidence });
      }
    }
    const evidence: LayoutEvidence[] = [];
    await renderVisualReviewFrames(
      engine,
      {
        scenes: [
          {
            id: "contrast",
            order: 0,
            templateId: engine === "hyperframes" ? "hf-statement" : "kinetic",
            text: "Keep the message clear",
            emphasis: [],
            motion: motionDirection("type-editorial"),
          },
        ],
        timeline: [{ sceneId: "contrast", startFrame: 0, durationFrames: 120 }],
        tokens: {
          ...defaultBrandTokens,
          accent: "#f2ece2",
        },
        width: 1080,
        height: 1920,
        fps: 30,
        hideProgressBar: true,
      },
      120,
      [78, 58],
      path.join(output, `${engine}-contrast`),
      "http://127.0.0.1:9999",
      undefined,
      (value) => evidence.push(value),
    );
    assert.deepEqual(
      evidence.map((value) => value.frame),
      [78, 58],
    );
    assert.ok(
      evidence[0].issues.some((issue) => issue.kind === "contrast"),
      JSON.stringify(evidence),
    );
    report.push({ engine, name: "low-contrast", evidence });
  }
  await fs.writeFile(
    path.join(output, "result.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(output);
}
void main();
