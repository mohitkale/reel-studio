/**
 * One frame per scene, tiled into a single JPEG, so a finished video can be
 * judged at a glance. Uses the FFmpeg the renderer already requires.
 */
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export interface ContactSheetScene {
  startFrame: number;
  durationFrames: number;
}

/** Frame time for each scene: 40% in, clamped inside the video. */
export function contactSheetTimes(
  scenes: readonly ContactSheetScene[],
  fps: number,
  totalSeconds: number,
): number[] {
  const last = Math.max(0, totalSeconds - 0.1);
  return scenes.map((scene) =>
    Math.min(last, (scene.startFrame + scene.durationFrames * 0.4) / fps),
  );
}

export async function renderContactSheet(input: {
  videoPath: string;
  outPath: string;
  times: readonly number[];
  columns: number;
  tileWidth: number;
  signal?: AbortSignal;
}): Promise<void> {
  if (input.times.length === 0)
    throw new Error("No scenes for a contact sheet");
  const dir = await mkdtemp(path.join(tmpdir(), "reel-sheet-"));
  try {
    for (const [index, time] of input.times.entries()) {
      await run(
        "ffmpeg",
        [
          "-y",
          "-v",
          "error",
          "-ss",
          time.toFixed(3),
          "-i",
          input.videoPath,
          "-frames:v",
          "1",
          "-vf",
          `scale=${input.tileWidth}:-2`,
          path.join(dir, `f_${String(index).padStart(3, "0")}.jpg`),
        ],
        { signal: input.signal },
      );
    }
    const columns = Math.min(input.columns, input.times.length);
    const rows = Math.ceil(input.times.length / columns);
    await run(
      "ffmpeg",
      [
        "-y",
        "-v",
        "error",
        "-framerate",
        "1",
        "-i",
        path.join(dir, "f_%03d.jpg"),
        "-vf",
        `tile=${columns}x${rows}:padding=6:margin=6:color=0x111111`,
        "-frames:v",
        "1",
        "-q:v",
        "3",
        input.outPath,
      ],
      { signal: input.signal },
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
