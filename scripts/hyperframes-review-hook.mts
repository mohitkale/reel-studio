/**
 * Snapshot adapter for the pinned CLI. Wrap its public Puppeteer screenshot
 * method inside this isolated process, after native seeking/footage injection.
 * Capture behavior and pixels stay owned by the existing CLI.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { Page } from "puppeteer-core";
import { z } from "zod";
import { productionLayoutSchema } from "../src/production/layout";
import {
  layoutEvidenceSchema,
  type LayoutEvidence,
} from "../src/production/visual-review-layout";

const config = z
  .object({
    frames: z.array(z.number().int().nonnegative()).min(1).max(8),
    layout: productionLayoutSchema,
    output: z.string(),
  })
  .parse(
    JSON.parse(
      await fs.readFile(process.env.REEL_REVIEW_CAPTURE_CONFIG!, "utf8"),
    ),
  );
const bundled = await build({
  entryPoints: [path.resolve("src/engines/hyperframes/review-layout.ts")],
  bundle: true,
  write: false,
  format: "iife",
  globalName: "ReelReviewLayout",
  platform: "browser",
});
const source = bundled.outputFiles[0].text;
const original = Page.prototype.screenshot;
const evidence: LayoutEvidence[] = [];
Page.prototype.screenshot = new Proxy(original, {
  async apply(screenshot, page: Page, args: Parameters<typeof original>) {
    // CLI takes exactly one screenshot per requested native point. Refuse drift.
    if (evidence.length >= config.frames.length)
      throw new Error("Unexpected native review screenshot");
    // Capture first: diagnostic style/font reads must not affect rasterization.
    const image = (await Reflect.apply(screenshot, page, args)) as
      string | Uint8Array;
    await page.evaluate(source);
    const result = await page.evaluate(
      (args) => {
        const root = document.getElementById("root");
        if (!root?.hasAttribute("data-total-frames"))
          throw new Error("Native review root missing");
        const helper = Reflect.get(window, "ReelReviewLayout") as {
          measureReviewLayout: typeof import("../src/production/visual-review-layout").measureReviewLayout;
        };
        return helper.measureReviewLayout(
          root,
          args.layout,
          args.frame,
          "section[data-scene-id] [data-graph-text], section[data-scene-id] .fx-line, section[data-scene-id] .fx-kicker, section[data-scene-id] .fx-check-item, section[data-scene-id] .dm-value, section[data-scene-id] .dm-value-label, section[data-scene-id] .dm-row-label, section[data-scene-id] .dm-source, section[data-scene-id] .gm-card, section[data-scene-id] .gm-number, section[data-scene-id] .tpl, section[data-scene-id] .sm-copy, section[data-scene-id] .sm-label, section[data-scene-id] .sm-number, section[data-scene-id] .sm-marker, section[data-scene-id] .sm-brand",
        );
      },
      { layout: config.layout, frame: config.frames[evidence.length] },
    );
    const validated = layoutEvidenceSchema.parse(result);
    evidence.push(validated);
    await fs.writeFile(config.output, JSON.stringify(evidence));
    return image;
  },
});
