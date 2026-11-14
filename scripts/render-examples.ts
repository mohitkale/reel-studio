/**
 * `npm run examples:render`: render every golden storyboard through the real
 * pipeline (POST /api/storyboards) into media/examples/<name>.mp4 with a
 * contact sheet beside it. The app and its worker must be running
 * (`npm run dev`). The podcast example is audio and is not rendered here.
 *
 *   npm run examples:render [-- --only product-launch] [--quality draft] [--force] [--base http://localhost:3000]
 */
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
const only = value("--only");
const force = args.includes("--force");
const outDir = path.resolve("media", "examples");

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
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

async function main(): Promise<void> {
  const { reports, problems } = checkExamples();
  if (problems.length > 0) {
    console.error("Fix the examples first (npm run examples:check):");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  await mkdir(outDir, { recursive: true });

  const summary: Array<{
    name: string;
    seconds: number;
    duration?: number;
    ok: boolean;
  }> = [];
  for (const report of reports) {
    if (only && report.name !== only) continue;
    if (report.kind === "podcast") {
      console.log(
        `- ${report.name}: audio episode, not rendered by this command`,
      );
      continue;
    }
    const started = Date.now();
    console.log(
      `→ ${report.name} (${report.format}, ~${Math.round(report.seconds)} s)`,
    );
    const body = await readFile(
      path.join(EXAMPLES_DIR, `${report.name}.json`),
      "utf8",
    );
    const query = new URLSearchParams({
      quality,
      ...(force ? { force: "1" } : {}),
    });
    const post = await fetch(`${base}/api/storyboards?${query}`, {
      method: "POST",
      headers,
      body,
    });
    const queued = (await post.json()) as { jobId?: string; error?: string };
    if (!queued.jobId)
      throw new Error(`${report.name}: ${queued.error ?? post.status}`);
    const job = await poll(queued.jobId);
    const video = job.outputs.find((o) => o.kind === "video");
    if (job.state !== "succeeded" || !video) {
      console.error(`  ✗ ${job.state}: ${job.error ?? "no video output"}`);
      summary.push({
        name: report.name,
        seconds: (Date.now() - started) / 1000,
        ok: false,
      });
      continue;
    }
    const metadata =
      video.metadata ??
      (JSON.parse(video.metadataJson ?? "{}") as Record<string, unknown>);
    // The artifact route describes the file; the file itself is at downloadUrl.
    const artifact = (await (
      await fetch(
        `${base}/api/production-jobs/${queued.jobId}/artifacts/${video.id}`,
        { headers },
      )
    ).json()) as { artifact?: { downloadUrl?: string } };
    const downloadUrl = artifact.artifact?.downloadUrl;
    if (!downloadUrl) throw new Error(`${report.name}: no download URL`);
    const mp4 = await fetch(`${base}${downloadUrl}`, { headers });
    await writeFile(
      path.join(outDir, `${report.name}.mp4`),
      Buffer.from(await mp4.arrayBuffer()),
    );
    if (typeof metadata.contactSheet === "string") {
      const sheet = await fetch(`${base}/media/${metadata.contactSheet}`, {
        headers,
      });
      if (sheet.ok)
        await writeFile(
          path.join(outDir, `${report.name}.contact-sheet.jpg`),
          Buffer.from(await sheet.arrayBuffer()),
        );
    }
    const seconds = (Date.now() - started) / 1000;
    summary.push({
      name: report.name,
      seconds,
      duration: Number(metadata.duration),
      ok: true,
    });
    console.log(
      `  ✓ ${Number(metadata.duration).toFixed(1)} s video in ${Math.round(seconds)} s wall time`,
    );
  }
  await writeFile(
    path.join(outDir, "report.json"),
    JSON.stringify({ base, quality, summary }, null, 2),
  );
  const failed = summary.filter((s) => !s.ok);
  console.log(
    `\n${summary.length - failed.length} of ${summary.length} rendered into ${path.relative(process.cwd(), outDir)}/`,
  );
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
