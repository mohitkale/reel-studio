#!/usr/bin/env node
/**
 * Isolated HyperFrames render worker.
 * Runs in a child process so @hyperframes/producer (Puppeteer, etc.) cannot
 * contaminate the Next.js server module graph / Response constructors.
 *
 * Usage:
 *   node scripts/hyperframes-render-worker.mjs <projectDir> <outputPath> <fps> <quality>
 *
 * Progress: HyperFrames reports job.progress as 0–100. We emit HF_PROGRESS as 0–1.
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

/** Normalize HyperFrames 0–100 progress to a 0–1 fraction for the parent. */
function toFraction(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  // Producer uses 0–100; tolerate a 0–1 value if an older build ever emits one.
  const pct = n > 1 ? n / 100 : n;
  return Math.max(0, Math.min(1, pct));
}

const job = createRenderJob({
  fps,
  quality: ["draft", "standard", "high"].includes(quality)
    ? quality
    : "standard",
  format: "mp4",
  entryFile: "index.html",
  strictness: "best-effort",
});

try {
  await executeRenderJob(job, projectDir, outputPath, (renderJob) => {
    const pct = toFraction(renderJob.progress);
    console.log(`HF_PROGRESS ${pct.toFixed(4)}`);
  });
  console.log("HF_DONE");
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  const warnings =
    err && typeof err === "object" && Array.isArray(err.warnings)
      ? err.warnings
          .map((w) => (w && typeof w === "object" && "message" in w ? w.message : String(w)))
          .filter(Boolean)
          .join("; ")
      : "";
  // Compact, machine-readable failure line for the parent (avoid dumping full logs).
  console.error(`HF_ERROR ${message}${warnings ? ` | ${warnings}` : ""}`);
  process.exitCode = 1;
}
