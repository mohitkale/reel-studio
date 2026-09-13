import { execFileSync } from "node:child_process";
import { cpus, platform, arch, totalmem } from "node:os";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { ORIENTATIONS, dimsFor } from "../src/lib/orientation";
import { PRODUCTION_PRESET_IDS } from "../src/production/presets";

const root = process.cwd();
const startedAt = new Date();
const results: Array<Record<string, unknown>> = [];
const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");

function probe(filename: string) {
  return JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "stream=codec_name,width,height",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        filename,
      ],
      { encoding: "utf8" },
    ),
  ) as {
    streams: Array<{ codec_name: string; width?: number; height?: number }>;
    format: { duration: string };
  };
}

for (const presetId of PRODUCTION_PRESET_IDS) {
  for (const orientation of ORIENTATIONS) {
    const combinationStarted = Date.now();
    console.log(`\n→ ${presetId} · ${orientation} · both engines`);
    execFileSync(
      process.execPath,
      [
        tsxCli,
        "scripts/render-regression.ts",
        `--preset=${presetId}`,
        `--orientation=${orientation}`,
      ],
      { cwd: root, stdio: "inherit", timeout: 12 * 60 * 1_000 },
    );
    const expected = dimsFor(orientation);
    for (const engine of ["hyperframes", "remotion"] as const) {
      const filename = path.join(
        root,
        ".artifacts",
        "render-regression",
        presetId,
        orientation,
        `${engine}.mp4`,
      );
      const metadata = probe(filename);
      const video = metadata.streams.find(
        (stream) => stream.codec_name === "h264",
      );
      if (video?.width !== expected.width || video.height !== expected.height) {
        throw new Error(
          `${presetId}/${orientation}/${engine}: dimensions drifted`,
        );
      }
      results.push({
        presetId,
        orientation,
        engine,
        width: video.width,
        height: video.height,
        durationSeconds: Number(metadata.format.duration),
        bytes: statSync(filename).size,
        artifact: path.relative(root, filename),
        combinationElapsedSeconds: Number(
          ((Date.now() - combinationStarted) / 1_000).toFixed(1),
        ),
      });
    }
  }
}

const report = {
  version: 1,
  startedAt: startedAt.toISOString(),
  completedAt: new Date().toISOString(),
  elapsedSeconds: Number(
    ((Date.now() - startedAt.getTime()) / 1_000).toFixed(1),
  ),
  environment: {
    platform: platform(),
    architecture: arch(),
    cpu: cpus()[0]?.model ?? "unknown",
    logicalCpus: cpus().length,
    memoryGiB: Number((totalmem() / 1024 ** 3).toFixed(1)),
    node: process.version,
    packageVersion: JSON.parse(readFileSync("package.json", "utf8")).version,
  },
  outputs: results,
};
const reportDir = path.join(root, ".artifacts", "release-matrix");
mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, "report.json");
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`\n✓ ${results.length} release renders verified`);
console.log(`✓ Performance report: ${reportPath}`);
