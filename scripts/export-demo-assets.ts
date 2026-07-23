/**
 * Export short HyperFrames demo MP4s + optional podcast take for docs/assets.
 *
 * Prerequisites: `npm run setup` (or seed scripts). Starts no HTTP server —
 * calls library services directly.
 *
 * Usage:
 *   npx tsx scripts/export-demo-assets.ts
 *   npx tsx scripts/export-demo-assets.ts --skip-podcast
 *   npx tsx scripts/export-demo-assets.ts --skip-video
 */

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  DEMO_PODCAST_TITLE,
  DEMO_VIDEO_PROJECT_NAME,
} from "../src/library/demo-content";
import { prisma } from "../src/library/db";
import { generateTake } from "../src/library/take-service";
import { createRender } from "../src/library/repositories/renders";
import { startRender } from "../src/library/render-service";
import { generatePodcastTake } from "../src/library/podcast-take-service";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "docs/assets/examples");
const MEDIA_ROOT = path.join(ROOT, "media");

function mediaUrlToAbs(urlOrKey: string): string {
  const key = urlOrKey.replace(/^\/media\//, "").replace(/^\//, "");
  return path.join(MEDIA_ROOT, key);
}

function runSeed(script: string, args: string[] = []) {
  const result = spawnSync("npx", ["tsx", script, ...args], {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(`Seed failed: ${script}`);
  }
}

async function waitForRender(id: string, timeoutMs = 15 * 60 * 1000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const row = await prisma.render.findUnique({ where: { id } });
    if (!row) throw new Error(`Render ${id} missing`);
    if (row.status === "done" && row.outputPath) {
      return mediaUrlToAbs(row.outputPath);
    }
    if (row.status === "error") {
      throw new Error(`Render ${id} failed: ${row.error ?? "unknown"}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Render ${id} timed out`);
}

async function exportVideos() {
  runSeed("scripts/seed-demo-project.ts", ["--all-formats"]);
  mkdirSync(OUT_DIR, { recursive: true });

  const formats: {
    name: string;
    out: string;
    poster: string;
  }[] = [
    {
      name: `${DEMO_VIDEO_PROJECT_NAME} (9:16)`,
      out: "portrait-demo.mp4",
      poster: "portrait-demo.jpg",
    },
    {
      name: `${DEMO_VIDEO_PROJECT_NAME} (16:9)`,
      out: "landscape-demo.mp4",
      poster: "landscape-demo.jpg",
    },
    {
      name: `${DEMO_VIDEO_PROJECT_NAME} (1:1)`,
      out: "square-demo.mp4",
      poster: "square-demo.jpg",
    },
  ];

  for (const format of formats) {
    const project = await prisma.project.findFirst({
      where: { name: format.name },
      include: { scripts: { orderBy: { createdAt: "asc" }, take: 1 } },
    });
    if (!project?.scripts[0]) {
      throw new Error(`Missing project ${format.name}`);
    }
    const scriptId = project.scripts[0].id;
    console.log(`\n→ Take + render: ${format.name}`);

    const take = await generateTake({
      scriptId,
      placeholder: true,
      label: "Demo silent take",
    });

    const render = await createRender({
      scriptId,
      voiceTakeId: take.id,
      quality: "draft",
      name: `Demo · ${format.out}`,
    });
    startRender({
      renderId: render.id,
      scriptId,
      voiceTakeId: take.id,
      quality: "draft",
      serverBaseUrl: "http://127.0.0.1:3000",
    });
    const abs = await waitForRender(render.id);
    const dest = path.join(OUT_DIR, format.out);
    copyFileSync(abs, dest);
    console.log(`  copied ${dest}`);

    // Poster via ffmpeg if available
    const posterDest = path.join(OUT_DIR, format.poster);
    const ff = spawnSync(
      "ffmpeg",
      ["-y", "-i", dest, "-ss", "0.5", "-vframes", "1", "-q:v", "3", posterDest],
      { stdio: "inherit" },
    );
    if (ff.status === 0) {
      console.log(`  poster ${posterDest}`);
    } else {
      console.warn(
        `  (ffmpeg poster skipped — install ffmpeg or capture manually)`,
      );
    }
  }
}

async function exportPodcast() {
  runSeed("scripts/seed-demo-podcast.ts");
  mkdirSync(OUT_DIR, { recursive: true });

  const podcast = await prisma.podcast.findFirst({
    where: { title: DEMO_PODCAST_TITLE },
  });
  if (!podcast) throw new Error("Demo podcast missing");

  console.log("\n→ Generating podcast take (kokoro-server)…");
  const take = await generatePodcastTake({
    podcastId: podcast.id,
    label: "Demo podcast take",
  });
  const abs = mediaUrlToAbs(take.audioUrl);
  if (!existsSync(abs)) {
    throw new Error(`Podcast audio missing at ${abs} (from ${take.audioUrl})`);
  }
  const destMp3 = path.join(OUT_DIR, "podcast-demo.mp3");
  const destWav = path.join(OUT_DIR, "podcast-demo.wav");
  const ffMp3 = spawnSync(
    "ffmpeg",
    ["-y", "-i", abs, "-codec:a", "libmp3lame", "-q:a", "4", destMp3],
    { stdio: "inherit" },
  );
  if (ffMp3.status !== 0) {
    copyFileSync(abs, destWav);
    console.log(`  copied ${destWav} (ffmpeg mp3 skipped)`);
  } else {
    console.log(`  copied ${destMp3}`);
    spawnSync(
      "ffmpeg",
      ["-y", "-i", abs, "-acodec", "pcm_s16le", "-ar", "22050", "-ac", "1", destWav],
      { stdio: "inherit" },
    );
    console.log(`  copied ${destWav}`);
  }
}

async function main() {
  const skipVideo = process.argv.includes("--skip-video");
  const skipPodcast = process.argv.includes("--skip-podcast");

  if (!skipVideo) await exportVideos();
  if (!skipPodcast) {
    try {
      await exportPodcast();
      console.warn(
        "\nNote: podcast WAV is for local verification only; README demos use MP4 audio.",
      );
    } catch (err) {
      console.warn(
        "\nPodcast export failed (Kokoro model download may be needed). Retry later:",
      );
      console.warn(err instanceof Error ? err.message : err);
    }
  } else {
    console.log("\nSkipping podcast export (README samples use video MP4 audio).");
  }

  console.log("\nDone. Assets under docs/assets/examples/");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
