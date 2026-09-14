import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpus, platform, arch, totalmem } from "node:os";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { ORIENTATIONS, dimsFor } from "../src/lib/orientation";
import { PRODUCTION_PRESET_IDS } from "../src/production/presets";
import releaseBriefs from "../tests/fixtures/release-briefs.json";

const root = process.cwd();
const startedAt = new Date();
const results: Array<Record<string, unknown>> = [];
const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
const resume = process.argv.includes("--resume");

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
  for (const [briefIndex, brief] of releaseBriefs[presetId].entries()) {
    const orientation = ORIENTATIONS[briefIndex];
    const combinationStarted = Date.now();
    console.log(
      `\n→ ${presetId} · brief ${briefIndex + 1} · ${orientation} · both engines`,
    );
    const filenames = (["hyperframes", "remotion"] as const).map((engine) =>
      path.join(
        root,
        ".artifacts",
        "render-regression",
        presetId,
        `brief-${briefIndex + 1}`,
        orientation,
        `${engine}.mp4`,
      ),
    );
    if (resume && filenames.every(existsSync)) {
      console.log("  ↳ reusing completed local artifacts");
    } else {
      execFileSync(
        process.execPath,
        [
          tsxCli,
          "scripts/render-regression.ts",
          `--preset=${presetId}`,
          `--brief-index=${briefIndex}`,
          `--orientation=${orientation}`,
        ],
        { cwd: root, stdio: "inherit", timeout: 12 * 60 * 1_000 },
      );
    }
    const expected = dimsFor(orientation);
    for (const [engineIndex, engine] of ["hyperframes", "remotion"].entries()) {
      const filename = filenames[engineIndex];
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
        briefIndex: briefIndex + 1,
        brief,
        briefHash: createHash("sha256").update(brief).digest("hex"),
        orientation,
        engine,
        width: video.width,
        height: video.height,
        durationSeconds: Number(metadata.format.duration),
        bytes: statSync(filename).size,
        artifactModifiedAt: statSync(filename).mtime.toISOString(),
        artifact: path.relative(root, filename),
        combinationElapsedSeconds: Number(
          ((Date.now() - combinationStarted) / 1_000).toFixed(1),
        ),
      });
    }
  }
}

const report = {
  version: 2,
  startedAt: startedAt.toISOString(),
  completedAt: new Date().toISOString(),
  elapsedSeconds: Number(
    ((Date.now() - startedAt.getTime()) / 1_000).toFixed(1),
  ),
  environment: {
    resumedFromExistingArtifacts: resume,
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
