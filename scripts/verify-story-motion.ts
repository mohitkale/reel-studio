/** Bounded native still review: three unrelated briefs, all ratios, both engines. No providers. */
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import type { LayoutEvidence } from "../src/production/visual-review-layout";
import { renderVisualReviewFrames } from "../src/library/visual-review";
import { defaultBrandTokens } from "../src/compositions/tokens";
import type { ReelProps, ReelScene } from "../src/compositions/types";
import { motionDirection, type MotionRecipeId } from "../src/production/motion";

async function main() {
  const output = path.resolve(".artifacts", `story-motion-${Date.now()}`);
  const limits = process.argv.includes("--limits");
  const baseline = process.argv.includes("--baseline");
  const fixtures = [
    {
      name: "garden-portrait",
      width: 1080,
      height: 1920,
      copy: [
        "Choose how you water",
        "Give roots time",
        "Grow at your own pace",
      ],
      items: ["Water at the roots", "Mist the leaves"],
      brand: "Root & Leaf",
    },
    {
      name: "workflow-landscape",
      width: 1920,
      height: 1080,
      copy: [
        "Compare the handoffs",
        "Pause for a review",
        "Make the next step clear",
      ],
      items: ["One owner per task", "A shared review queue"],
      brand: "Studio North",
    },
    {
      name: "history-square",
      width: 1080,
      height: 1080,
      copy: [
        "Read both accounts",
        "Leave room for uncertainty",
        "Follow the original sources",
      ],
      items: ["An eyewitness diary", "A later oral account"],
      brand: "Archive Notes",
    },
  ];
  const recipes = [
    "comparison-split",
    "comparison-stack",
    "quiet-divider",
    "quiet-center",
    "brand-lockup",
    "brand-frame",
  ] as const;
  await fs.mkdir(output, { recursive: true });
  const report: unknown[] = [];
  for (const engine of ["remotion", "hyperframes"] as const) {
    if (process.argv.includes("--engine=remotion") && engine !== "remotion")
      continue;
    for (const fixture of fixtures) {
      const directory = path.join(output, `${engine}-${fixture.name}`);
      const scenes: ReelScene[] = (
        baseline ? [0, 2, 4] : [0, 1, 2, 3, 4, 5]
      ).map((choice, index) => ({
        id: `scene-${index}`,
        order: index,
        text: limits
          ? "W".repeat(choice < 2 ? 90 : choice < 4 ? 160 : 110)
          : fixture.copy[Math.floor(choice / 2)],
        emphasis: [],
        role: choice < 2 ? "comparison" : choice < 4 ? "summary" : "cta",
        items:
          choice < 2
            ? limits
              ? ["W".repeat(60), "W".repeat(60)]
              : fixture.items
            : undefined,
        templateId: engine === "hyperframes" ? "hf-statement" : "kinetic",
        ...(!baseline
          ? { motion: motionDirection(recipes[choice] as MotionRecipeId) }
          : {}),
      }));
      const props: ReelProps & { fps: number } = {
        scenes,
        timeline: scenes.map((scene, index) => ({
          sceneId: scene.id,
          startFrame: index * 120,
          durationFrames: 120,
        })),
        tokens: {
          ...defaultBrandTokens,
          handle: limits ? "W".repeat(60) : fixture.brand,
        },
        width: fixture.width,
        height: fixture.height,
        fps: 30,
        preset: { id: "creator-punch", version: "1.0.0" },
        hideProgressBar: true,
        reviewLayout: !baseline,
      };
      const frames = scenes.map((_, index) => index * 120 + 60);
      if (!baseline && !limits) frames.push(12, 4 * 120 + 12);
      const evidence: LayoutEvidence[] = [];
      const paths = await renderVisualReviewFrames(
        engine,
        props,
        scenes.length * 120,
        frames,
        directory,
        "http://127.0.0.1:9999",
        undefined,
        baseline ? undefined : (value) => evidence.push(value),
      );
      assert.equal(paths.length, frames.length);
      if (!baseline) {
        assert.equal(evidence.length, frames.length);
        for (const item of evidence.slice(0, 6)) {
          assert.ok(
            item.checkedTextNodes >= 1,
            `${engine}: missing text measurements`,
          );
          assert.deepEqual(
            item.issues,
            [],
            `${engine}: unexpected layout finding at frame ${item.frame}`,
          );
        }
      }
      const tiles = await Promise.all(
        paths.map(async (filename) => {
          const meta = await sharp(filename).metadata();
          assert.equal(meta.width, fixture.width);
          assert.equal(meta.height, fixture.height);
          return sharp(filename)
            .resize(240, 240, { fit: "contain", background: "#222" })
            .png()
            .toBuffer();
        }),
      );
      await sharp({
        create: { width: 960, height: 480, channels: 3, background: "#222" },
      })
        .composite(
          tiles.map((input, index) => ({
            input,
            left: (index % 4) * 240,
            top: Math.floor(index / 4) * 240,
          })),
        )
        .png()
        .toFile(path.join(directory, "sheet.png"));
      // Re-capture in reverse temporal order, covering both earlier and later scenes.
      if (!baseline && !limits && fixture === fixtures[0]) {
        const reverse = await renderVisualReviewFrames(
          engine,
          props,
          scenes.length * 120,
          [660, 540, 420, 300, 180, 60, 12],
          path.join(directory, "reverse"),
          "http://127.0.0.1:9999",
        );
        const expected = [5, 4, 3, 2, 1, 0, 6];
        for (const [index, filename] of reverse.entries()) {
          const a = await sharp(filename).raw().toBuffer();
          const b = await sharp(paths[expected[index]]).raw().toBuffer();
          assert.equal(
            createHash("sha256").update(a).digest("hex"),
            createHash("sha256").update(b).digest("hex"),
            `${engine} reverse seek differed at ${index}`,
          );
        }
      }
      report.push({
        evidence,
        engine,
        fixture: fixture.name,
        width: fixture.width,
        height: fixture.height,
        frames,
        sheet: path.relative(output, path.join(directory, "sheet.png")),
      });
      process.stdout.write(
        `${engine}: ${fixture.name} — ${frames.length} native frames passed\n`,
      );
    }
  }
  await fs.writeFile(
    path.join(output, "result.json"),
    JSON.stringify(
      {
        fixtures: report,
        baseline,
        limits,
        reverseSeekMatched: !baseline && !limits,
      },
      null,
      2,
    ),
  );
  process.stdout.write(`Evidence: ${output}\n`);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
