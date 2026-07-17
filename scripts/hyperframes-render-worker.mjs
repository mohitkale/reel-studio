#!/usr/bin/env node
/**
 * Isolated HyperFrames render worker.
 * Runs in a child process so @hyperframes/producer (Puppeteer, etc.) cannot
 * contaminate the Next.js server module graph / Response constructors.
 *
 * Usage:
 *   node scripts/hyperframes-render-worker.mjs <projectDir> <outputPath> <fps> <quality>
 */

import path from "node:path";
import { pathToFileURL } from "node:url";

const [projectDir, outputPath, fpsRaw, quality = "standard"] = process.argv.slice(2);

if (!projectDir || !outputPath || !fpsRaw) {
  console.error(
    "Usage: hyperframes-render-worker.mjs <projectDir> <outputPath> <fps> <quality>",
  );
  process.exit(2);
}

const fps = Number(fpsRaw);
if (!Number.isFinite(fps) || fps <= 0) {
  console.error("Invalid fps:", fpsRaw);
  process.exit(2);
}

const producerUrl = pathToFileURL(
  path.resolve(
    process.cwd(),
    "node_modules/@hyperframes/producer/dist/index.js",
  ),
).href;

const { createRenderJob, executeRenderJob } = await import(producerUrl);

const job = createRenderJob({
  fps,
  quality: ["draft", "standard", "high"].includes(quality)
    ? quality
    : "standard",
  format: "mp4",
  entryFile: "index.html",
  strictness: "best-effort",
});

await executeRenderJob(job, projectDir, outputPath, (renderJob) => {
  const pct = Math.max(0, Math.min(1, Number(renderJob.progress) || 0));
  // Machine-readable progress line for the parent process.
  console.log(`HF_PROGRESS ${pct.toFixed(4)}`);
});

console.log("HF_DONE");
