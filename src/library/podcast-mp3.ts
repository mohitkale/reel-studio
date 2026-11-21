import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";

import { transcodeWavToMp3 } from "@/lib/audio-production";
import type { PodcastChapterDTO } from "@/lib/dto";

const artwork = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <rect width="600" height="600" fill="#171528"/>
  <circle cx="300" cy="300" r="192" fill="#32275c"/>
  <path d="M170 300h32l34-67 40 126 45-157 42 113 29-43 25 28h13"
        fill="none" stroke="#c7b8ff" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

function ffmetadataValue(value: string) {
  return value.replace(/[\r\n]+/g, " ").replace(/[\\=;#]/g, "\\$&");
}

export async function encodePodcastMp3(
  wav: Buffer,
  episode: { title: string; fps: number; chapters: PodcastChapterDTO[] },
) {
  const milliseconds = (frame: number) =>
    Math.round((frame / episode.fps) * 1000);
  const metadata = [
    ";FFMETADATA1",
    `title=${ffmetadataValue(episode.title)}`,
    ...episode.chapters.flatMap((chapter) => [
      "[CHAPTER]",
      "TIMEBASE=1/1000",
      `START=${milliseconds(chapter.startFrame)}`,
      `END=${milliseconds(chapter.endFrame)}`,
      `title=${ffmetadataValue(chapter.title)}`,
    ]),
    "",
  ].join("\n");
  const directory = await fs.mkdtemp(path.join(tmpdir(), "reel-podcast-tags-"));
  try {
    const artworkFile = path.join(directory, "cover.jpg");
    const metadataFile = path.join(directory, "episode.ffmeta");
    await sharp(Buffer.from(artwork)).jpeg({ quality: 90 }).toFile(artworkFile);
    await fs.writeFile(metadataFile, metadata);
    return await transcodeWavToMp3(wav, undefined, {
      artworkFile,
      metadataFile,
      outputFile: path.join(directory, "episode.mp3"),
    });
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}
