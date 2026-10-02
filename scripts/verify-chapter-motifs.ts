/** Bounded native still review: three unrelated briefs, all ratios, HyperFrames. No providers. */
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { renderVisualReviewFrames } from "../src/library/visual-review";
import { defaultBrandTokens } from "../src/video/tokens";
import type { ReelProps, ReelScene } from "../src/video/types";
import { motionDirection, type MotionRecipeId } from "../src/production/motion";

async function main() {
  const output = path.resolve(".artifacts", `chapter-motifs-${Date.now()}`);
  const fixtures = [
    {
      name: "garden-portrait",
      width: 1080,
      height: 1920,
      copy: [
        "Start with the soil",
        "Give roots room to grow",
        "Water at the roots",
        "Watch the leaves respond",
      ],
    },
    {
      name: "workflow-landscape",
      width: 1920,
      height: 1080,
      copy: [
        "Make the next step clear",
        "Keep handoffs easy to follow",
        "Review one change at a time",
        "Let the finished work speak",
      ],
    },
    {
      name: "history-square",
      width: 1080,
      height: 1080,
      copy: [
        "Follow the original sources",
        "Place each account in context",
        "Compare the surviving records",
        "Leave room for uncertainty",
      ],
    },
  ];
  const combinations = [
    { recipeId: "type-impact", typeEntrance: "sweep" },
    { recipeId: "type-editorial", typeEntrance: "sweep" },
    { recipeId: "type-impact", typeEntrance: "rise" },
    { recipeId: "type-editorial", typeEntrance: "rise" },
  ] as const;
  await fs.mkdir(output, { recursive: true });
  const report: unknown[] = [];
  for (const engine of ["hyperframes"] as const) {
    for (const fixture of fixtures) {
      const directory = path.join(output, `${engine}-${fixture.name}`);
      const scenes: ReelScene[] = combinations.map((choice, index) => ({
        id: `scene-${index}`,
        order: index,
        text: fixture.copy[index],
        emphasis: [],
        role: "headline",
        templateId: "hf-statement",
        motion: {
          ...motionDirection(choice.recipeId as MotionRecipeId),
          typeEntrance: choice.typeEntrance,
        },
      }));
      const props: ReelProps & { fps: number } = {
        scenes,
        timeline: scenes.map((scene, index) => ({
          sceneId: scene.id,
          startFrame: index * 60,
          durationFrames: 60,
        })),
        tokens: defaultBrandTokens,
        width: fixture.width,
        height: fixture.height,
        fps: 30,
        preset: { id: "creator-punch", version: "1.0.0" },
        hideProgressBar: true,
      };
      const frames = scenes.flatMap((_, index) => [
        index * 60 + 10,
        index * 60 + 30,
      ]);
      const paths = await renderVisualReviewFrames(
        engine,
        props,
        240,
        frames,
        directory,
        "http://127.0.0.1:9999",
      );
      assert.equal(paths.length, 8);
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
            left: Math.floor(index / 2) * 240,
            top: (index % 2) * 240,
          })),
        )
        .png()
        .toFile(path.join(directory, "sheet.png"));
      // Re-capture in reverse temporal order, covering both earlier and later scenes.
      if (fixture === fixtures[0]) {
        const reverse = await renderVisualReviewFrames(
          engine,
          props,
          240,
          [210, 130, 90, 10],
          path.join(directory, "reverse"),
          "http://127.0.0.1:9999",
        );
        const expected = [7, 4, 3, 0];
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
        engine,
        fixture: fixture.name,
        width: fixture.width,
        height: fixture.height,
        frames,
        sheet: path.relative(output, path.join(directory, "sheet.png")),
      });
      process.stdout.write(
        `${engine}: ${fixture.name} — 8 native frames passed\n`,
      );
    }
  }
  await fs.writeFile(
    path.join(output, "result.json"),
    JSON.stringify({ fixtures: report, reverseSeekMatched: true }, null, 2),
  );
  process.stdout.write(`Evidence: ${output}\n`);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
