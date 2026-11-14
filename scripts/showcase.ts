/**
 * `npm run showcase`: render the golden storyboards in their primary format with
 * voice, captions, music and the theme each one names, then write
 * `media/showcase/index.html` with every video and its frame-check result
 * (roadmap V10). The app and its worker must be running (`npm run dev`).
 *
 *   npm run showcase [-- --only listicle,story] [--quality standard] [--base http://localhost:3000]
 *
 * The rubric column is for the maintainer's 20-point review (docs/QUALITY.md).
 */
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { checkExamples, EXAMPLES_DIR } from "../src/storyboard/examples-check";

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
const quality = value("--quality") ?? "standard";
const only = value("--only")?.split(",");
const outDir = path.resolve("media", "showcase");
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
    id: string;
    kind: string;
    metadata?: Record<string, unknown>;
    metadataJson?: string | null;
  }>;
}

async function poll(jobId: string): Promise<JobView> {
  const deadline = Date.now() + 40 * 60_000;
  for (;;) {
    const response = await fetch(`${base}/api/production-jobs/${jobId}`, {
      headers,
    });
    const view = (await response.json()) as { job?: JobView } & JobView;
    const job = view.job ?? view;
    if (["succeeded", "failed", "canceled"].includes(job.state)) return job;
    if (Date.now() > deadline)
      throw new Error(`Timed out waiting for job ${jobId}`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

async function main(): Promise<void> {
  const { reports, problems } = checkExamples();
  if (problems.length > 0) {
    console.error("Fix the examples first (npm run examples:check):");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  await mkdir(outDir, { recursive: true });

  // Frame-check scores come from the same storyboards, in their own formats.
  const lintDir = path.join(outDir, "frame-lint");
  try {
    execFileSync(
      "node",
      ["--import", "tsx", "scripts/frame-lint.mjs", "--out", lintDir],
      { stdio: "pipe" },
    );
  } catch {
    /* failures are read from the report */
  }
  const lint = JSON.parse(
    await readFile(path.join(lintDir, "frame-lint.json"), "utf8"),
  ) as {
    examples: Array<{
      name: string;
      monotony?: unknown;
      scenes: Array<{ failures: Array<{ check: string }> }>;
    }>;
  };

  const cards: string[] = [];
  let failed = 0;
  for (const report of reports) {
    if (report.kind === "podcast" || (only && !only.includes(report.name)))
      continue;
    const started = Date.now();
    console.log(
      `→ ${report.name} (${report.format}, ~${Math.round(report.seconds)} s)`,
    );
    const body = await readFile(
      path.join(EXAMPLES_DIR, `${report.name}.json`),
      "utf8",
    );
    const post = await fetch(
      `${base}/api/storyboards?${new URLSearchParams({ quality, force: "1" })}`,
      { method: "POST", headers, body },
    );
    const queued = (await post.json()) as { jobId?: string; error?: string };
    if (!queued.jobId)
      throw new Error(`${report.name}: ${queued.error ?? post.status}`);
    const job = await poll(queued.jobId);
    const video = job.outputs.find((o) => o.kind === "video");
    if (job.state !== "succeeded" || !video) {
      failed += 1;
      console.error(`  ✗ ${job.state}: ${job.error ?? "no video output"}`);
      continue;
    }
    const artifact = (await (
      await fetch(
        `${base}/api/production-jobs/${queued.jobId}/artifacts/${video.id}`,
        { headers },
      )
    ).json()) as {
      artifact?: { downloadUrl?: string; metadata?: Record<string, unknown> };
    };
    const url = artifact.artifact?.downloadUrl;
    if (!url) throw new Error(`${report.name}: no download URL`);
    await writeFile(
      path.join(outDir, `${report.name}.mp4`),
      Buffer.from(
        await (await fetch(`${base}${url}`, { headers })).arrayBuffer(),
      ),
    );
    const mastering = (artifact.artifact?.metadata?.audioMastering ?? {}) as {
      after?: { integratedLufs?: number; truePeakDbtp?: number };
    };
    const example = lint.examples.find((e) => e.name === report.name);
    const checks =
      example?.scenes.flatMap((s) => s.failures.map((f) => f.check)) ?? [];
    const seconds = Math.round((Date.now() - started) / 1000);
    console.log(
      `  ✓ ${seconds} s wall time, ${checks.length} frame-check failure(s)`,
    );
    cards.push(`<section>
  <h2>${escapeHtml(report.name)} <small>${report.format}, ${Math.round(report.seconds)} s</small></h2>
  <video src="${escapeHtml(report.name)}.mp4" controls preload="metadata"></video>
  <p>Frame check: <b class="${checks.length ? "bad" : "ok"}">${checks.length ? `${checks.length} failure(s): ${[...new Set(checks)].join(", ")}` : "0 failures"}</b>
  · Loudness: ${mastering.after?.integratedLufs ?? "n/a"} LUFS, ${mastering.after?.truePeakDbtp ?? "n/a"} dBTP
  · Rubric: <input size="3" aria-label="Rubric score out of 20" placeholder="/20"></p>
</section>`);
  }
  await writeFile(
    path.join(outDir, "index.html"),
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reel Studio showcase</title>
<style>body{font:16px system-ui;margin:2rem auto;max-width:1100px;padding:0 1rem}section{margin:2rem 0}video{max-width:100%;max-height:70vh;background:#000}small{color:#666;font-weight:400}.ok{color:#1a7f37}.bad{color:#b42318}</style>
<h1>Reel Studio showcase</h1><p>Rendered at ${escapeHtml(quality)} quality with voice, captions, music and each storyboard's theme. Score each video out of 20 with the rubric in docs/QUALITY.md.</p>
${cards.join("\n")}`,
  );
  console.log(
    `\n${cards.length} rendered, ${failed} failed: ${path.relative(process.cwd(), path.join(outDir, "index.html"))}`,
  );
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
