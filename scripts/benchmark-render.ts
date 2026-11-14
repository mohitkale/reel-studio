/**
 * `npm run benchmark:render`: how long a render takes on this machine
 * (roadmap V9). Renders golden storyboards without narration at draft,
 * standard and high quality through the real pipeline, and reports seconds of
 * render per second of video plus the machine it ran on. The app and its worker
 * must be running (`npm run dev`).
 *
 *   npm run benchmark:render [-- --only motivation,listicle] [--qualities draft,standard,high] [--base http://localhost:3000]
 */
import { cpus, platform, release, totalmem } from "node:os";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { EXAMPLES_DIR } from "../src/storyboard/examples-check";

const args = process.argv.slice(2);
const value = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const base = (
  value("--base") ??
  process.env.REEL_STUDIO_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");
const only = (value("--only") ?? "motivation").split(",");
const qualities = (value("--qualities") ?? "draft,standard,high").split(",");
const headers: Record<string, string> = {
  "content-type": "application/json",
  origin: base,
  ...(process.env.REEL_STUDIO_MCP_TOKEN
    ? { authorization: `Bearer ${process.env.REEL_STUDIO_MCP_TOKEN}` }
    : {}),
};

interface JobView {
  state: string;
  error?: string | null;
  outputs: Array<{
    kind: string;
    metadataJson?: string | null;
    metadata?: Record<string, unknown>;
  }>;
}

async function poll(jobId: string): Promise<JobView> {
  const deadline = Date.now() + 30 * 60_000;
  for (;;) {
    const response = await fetch(`${base}/api/production-jobs/${jobId}`, {
      headers,
    });
    const view = (await response.json()) as { job?: JobView } & JobView;
    const job = view.job ?? view;
    if (["succeeded", "failed", "canceled"].includes(job.state)) return job;
    if (Date.now() > deadline)
      throw new Error(`Timed out waiting for job ${jobId}`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

async function main(): Promise<void> {
  const rows: Array<{
    example: string;
    quality: string;
    videoSeconds: number;
    wallSeconds: number;
    ratio: number;
  }> = [];
  for (const name of only) {
    const storyboard = JSON.parse(
      await readFile(path.join(EXAMPLES_DIR, `${name}.json`), "utf8"),
    );
    // Silent: the benchmark measures rendering, not voice synthesis or downloads.
    storyboard.voice = { enabled: false };
    storyboard.music = "none";
    for (const quality of qualities) {
      const started = Date.now();
      const post = await fetch(
        `${base}/api/storyboards?${new URLSearchParams({ quality, force: "1" })}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(storyboard),
        },
      );
      const queued = (await post.json()) as { jobId?: string; error?: string };
      if (!queued.jobId)
        throw new Error(`${name}: ${queued.error ?? post.status}`);
      const job = await poll(queued.jobId);
      const video = job.outputs.find((o) => o.kind === "video");
      if (job.state !== "succeeded" || !video)
        throw new Error(`${name} ${quality}: ${job.state} ${job.error ?? ""}`);
      const metadata =
        video.metadata ??
        (JSON.parse(video.metadataJson ?? "{}") as Record<string, unknown>);
      const wallSeconds = (Date.now() - started) / 1000;
      const videoSeconds = Number(metadata.duration);
      const ratio = wallSeconds / videoSeconds;
      rows.push({ example: name, quality, videoSeconds, wallSeconds, ratio });
      console.log(
        `${name} ${quality}: ${videoSeconds.toFixed(1)} s video in ${wallSeconds.toFixed(0)} s (${ratio.toFixed(2)}x)`,
      );
    }
  }

  const cpu = cpus();
  const machine = {
    os: `${platform()} ${release()}`,
    cpu: cpu[0]?.model ?? "unknown",
    cores: cpu.length,
    memoryGb: Math.round(totalmem() / 1024 ** 3),
    node: process.version,
  };
  await mkdir("docs/quality", { recursive: true });
  await writeFile(
    "docs/quality/render-benchmark.json",
    JSON.stringify(
      { recordedAt: new Date().toISOString().slice(0, 10), machine, rows },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "\n| Example | Quality | Video (s) | Render (s) | Render s per video s |\n| --- | --- | ---: | ---: | ---: |",
  );
  for (const r of rows)
    console.log(
      `| ${r.example} | ${r.quality} | ${r.videoSeconds.toFixed(1)} | ${r.wallSeconds.toFixed(0)} | ${r.ratio.toFixed(2)} |`,
    );
  console.log(
    `\nMachine: ${machine.cpu}, ${machine.cores} cores, ${machine.memoryGb} GB, ${machine.os}, Node ${machine.node}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
