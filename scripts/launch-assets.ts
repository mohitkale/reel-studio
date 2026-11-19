/**
 * `npm run launch:assets`: make the launch video and its three short clips
 * (roadmap L5) into `dist/launch/`.
 *
 *   npm run launch:assets [-- --base http://localhost:3000] [-- --quality standard]
 *
 * The video is `docs/launch/launch-video.storyboard.json` rendered by a running
 * studio (`npm run dev`), like any other storyboard: local voice, captions, music.
 * The clips are cut from it at scene boundaries. Nothing is uploaded.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const value = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const base = (
  value("--base") ??
  process.env.REEL_STUDIO_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");
const quality = value("--quality") ?? "standard";
const has = (name: string) => argv.includes(name);
const OUT = path.resolve("dist/launch");
/** Scenes cross-fade; a clip starts and ends this far inside its scenes so no frame is a blend. */
const FADE_MARGIN = 0.5;
const headers: Record<string, string> = {
  "content-type": "application/json",
  origin: base,
  ...(process.env.REEL_STUDIO_MCP_TOKEN
    ? { authorization: `Bearer ${process.env.REEL_STUDIO_MCP_TOKEN}` }
    : {}),
};

/** Clips are cut where a scene starts, so no clip opens or ends mid-sentence. */
const CLIPS = [
  { name: "clip-1-how-it-works", fromScene: 0, toScene: 3 },
  { name: "clip-2-agent-and-compare", fromScene: 4, toScene: 7 },
  { name: "clip-3-what-you-get", fromScene: 7, toScene: 10 },
] as const;

interface Job {
  state: string;
  error?: string | null;
  steps: Array<{
    key: string;
    detail?: { timeline?: Array<{ startFrame: number }>; fps?: number };
  }>;
  outputs: Array<{ downloadUrl: string }>;
}

async function render(): Promise<{ file: string; sceneStarts: number[] }> {
  const storyboard = JSON.parse(
    readFileSync("docs/launch/launch-video.storyboard.json", "utf8"),
  );
  const queued = await fetch(`${base}/api/storyboards?force=1`, {
    method: "POST",
    headers,
    body: JSON.stringify({ storyboard, quality }),
  });
  if (queued.status !== 202)
    throw new Error(
      `The storyboard was refused: ${queued.status} ${await queued.text()}`,
    );
  const { jobId } = (await queued.json()) as { jobId: string };
  const deadline = Date.now() + 40 * 60_000;
  let job: Job | undefined;
  while (Date.now() < deadline) {
    job = (
      (await (
        await fetch(`${base}/api/production-jobs/${jobId}`, { headers })
      ).json()) as { job: Job }
    ).job;
    if (["succeeded", "failed", "canceled"].includes(job.state)) break;
    await new Promise((r) => setTimeout(r, 5000));
  }
  if (!job || job.state !== "succeeded")
    throw new Error(
      `The render ${job?.state ?? "timed out"}: ${job?.error ?? ""}`,
    );
  const timeline = job.steps.find((s) => s.key === "time_content")?.detail
    ?.timeline;
  if (!timeline?.length) throw new Error("The job has no scene timeline");
  const response = await fetch(`${base}${job.outputs[0]!.downloadUrl}`, {
    headers,
  });
  const file = path.join(OUT, "launch-video.mp4");
  writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  return { file, sceneStarts: timeline.map((t) => t.startFrame / 30) };
}

function duration(file: string): number {
  return Number(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=nw=1:nk=1",
        file,
      ],
      { encoding: "utf8" },
    ).trim(),
  );
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  // `--reuse` cuts the clips again from the video made by an earlier run.
  const { file, sceneStarts } = has("--reuse")
    ? {
        file: path.join(OUT, "launch-video.mp4"),
        sceneStarts: JSON.parse(
          readFileSync(path.join(OUT, "scene-starts.json"), "utf8"),
        ) as number[],
      }
    : await render();
  writeFileSync(
    path.join(OUT, "scene-starts.json"),
    JSON.stringify(sceneStarts),
  );
  const total = duration(file);
  const manifest: Array<{ file: string; seconds: number; bytes: number }> = [
    {
      file: "launch-video.mp4",
      seconds: Math.round(total),
      bytes: statSync(file).size,
    },
  ];
  for (const clip of CLIPS) {
    const first = clip.fromScene === 0;
    const last = clip.toScene >= sceneStarts.length;
    const start = sceneStarts[clip.fromScene]! + (first ? 0 : FADE_MARGIN);
    const end = last ? total : sceneStarts[clip.toScene]! - FADE_MARGIN;
    const out = path.join(OUT, `${clip.name}.mp4`);
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-loglevel",
        "error",
        "-ss",
        start.toFixed(2),
        "-to",
        end.toFixed(2),
        "-i",
        file,
        "-vf",
        "scale=1280:720:flags=lanczos",
        "-af",
        `afade=t=in:st=0:d=0.15,afade=t=out:st=${Math.max(0, end - start - 0.3).toFixed(2)}:d=0.3`,
        "-c:v",
        "libx264",
        "-crf",
        "24",
        "-preset",
        "medium",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        out,
      ],
      { stdio: "inherit" },
    );
    manifest.push({
      file: `${clip.name}.mp4`,
      seconds: Math.round(end - start),
      bytes: statSync(out).size,
    });
  }
  writeFileSync(
    path.join(OUT, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  for (const m of manifest)
    console.log(
      `${m.file.padEnd(32)} ${String(m.seconds).padStart(3)} s  ${(m.bytes / 1048576).toFixed(1)} MB`,
    );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
