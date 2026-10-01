import { cancelChild } from "../src/library/production-cancellation";
/** Six bounded five-minute footage exports, sequential and offline. */
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  VIDEO_BENCHMARK_PROFILES,
  videoBenchmarkProfileSchema,
} from "../src/production/video-benchmark";
const engineFlag = process.argv
  .find((value) => value.startsWith("--engine="))
  ?.slice(9);
const engines = engineFlag
  ? [z.enum(["remotion", "hyperframes"]).parse(engineFlag)]
  : ["remotion", "hyperframes"];
const profileFlag = process.argv
  .find((value) => value.startsWith("--profile="))
  ?.slice(10);
const profiles = profileFlag
  ? [videoBenchmarkProfileSchema.parse(profileFlag)]
  : videoBenchmarkProfileSchema.options;
const finishing = process.argv.includes("--finishing");
const rowSchema = z.object({
  engine: z.enum(["remotion", "hyperframes"]),
  benchmarkId: videoBenchmarkProfileSchema,
  quality: z.enum(["draft", "standard", "high"]),
  seconds: z.literal(300),
  fps: z.literal(24),
  frames: z.literal(7200),
  secondsPerVideoMinute: z.number().positive(),
  secondsPerVideoMinuteOnRetry: z.number().positive(),
  first: z.object({
    milliseconds: z.number(),
    sampledPeakProcessTreeRssBytes: z.number().nullable(),
    metadata: z.object({
      width: z.number(),
      height: z.number(),
      duration: z.number(),
    }),
  }),
  finishingReport: z.unknown().optional(),
});
const cancellation = new AbortController();
process.once("SIGINT", () => cancellation.abort());
process.once("SIGTERM", () => cancellation.abort());
async function main() {
  const root = path.resolve(".artifacts", `long-video-benchmark-${Date.now()}`);
  await fs.mkdir(root, { recursive: true });
  const rows: z.infer<typeof rowSchema>[] = [];
  for (const engine of engines)
    for (const profile of profiles) {
      cancellation.signal.throwIfAborted();
      const directory = path.join(root, `${engine}-${profile}`);
      const log = await fs.open(
        path.join(root, `${engine}-${profile}.log`),
        "wx",
      );
      const args = [
        "--import",
        "tsx",
        "scripts/verify-video-sections.ts",
        `--engine=${engine}`,
        `--benchmark=${profile}`,
        `--evidence=${directory}`,
        ...(finishing && VIDEO_BENCHMARK_PROFILES[profile].quality === "high"
          ? ["--finishing"]
          : []),
      ];
      console.log(
        `Benchmark ${engine} / ${profile}: 300s, footage, captions, continuous audio${args.includes("--finishing") ? ", finishing experiment" : ""}`,
      );
      try {
        await new Promise<void>((resolve, reject) => {
          const child = spawn(process.execPath, args, {
            stdio: ["ignore", log.fd, log.fd],
            detached: process.platform !== "win32",
          });
          cancelChild(child, cancellation.signal);
          child.once("error", reject);
          child.once("close", (code) =>
            code === 0
              ? resolve()
              : reject(
                  new Error(
                    `${engine}/${profile} failed. Inspect ${path.basename(root)}/${engine}-${profile}.log`,
                  ),
                ),
          );
        });
      } finally {
        await log.close();
      }
      rows.push(
        ...z
          .array(rowSchema)
          .parse(
            JSON.parse(
              await fs.readFile(path.join(directory, "result.json"), "utf8"),
            ),
          ),
      );
      await fs.writeFile(
        path.join(root, "results.json"),
        JSON.stringify(rows, null, 2),
      );
    }
  const lines = rows.map(
    (row) =>
      `| ${row.engine} | ${row.benchmarkId} | ${row.first.metadata.width}×${row.first.metadata.height} | ${row.secondsPerVideoMinute.toFixed(1)} | ${row.secondsPerVideoMinuteOnRetry.toFixed(1)} | ${row.first.sampledPeakProcessTreeRssBytes === null ? "unavailable" : (row.first.sampledPeakProcessTreeRssBytes / 1024 ** 2).toFixed(0)} |`,
  );
  await fs.writeFile(
    path.join(root, "REPORT.md"),
    `# Five-minute native footage benchmarks\n\nAll rows: 300 seconds, 24 fps, 7,200 frames, ten chapters, local 8-second footage with final-frame holds, captions, narration calibration, music, SFX and measured final mastering. Timings include native planning, rendering, assembly and mastering; retries validate exact packet hashes. Memory is sampled process-tree peak RSS, not a portable limit. Engine quality tiers have different output scaling. Finishing remains an explicit offline experiment.\n\n| Engine | Profile | Encoded pixels | Seconds per video minute | Retry seconds per minute | Peak MiB |\n| --- | --- | --- | --- | --- | --- |\n${lines.join("\n")}\n`,
  );
  console.log(`Benchmark matrix passed. Evidence: ${root}`);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
