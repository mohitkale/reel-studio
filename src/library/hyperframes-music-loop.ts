import path from "node:path";
import { promises as fs } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { assertPathInsideRoot } from "@/server/url-safety";
import {
  assertProductionActive,
  productionSignal,
} from "@/library/production-cancellation";

const execute = promisify(execFile);

/** Producer 0.8.40 recognizes HTML loops but mixes only the source's duration.
 * Freeze local music into a continuous PCM source before its native audio mix.
 */
export async function extendHyperframesMusic(
  projectDir: string,
  musicUrl: string | undefined,
  durationSeconds: number,
): Promise<string | undefined> {
  if (!musicUrl || /^(https?:|data:|blob:)/.test(musicUrl)) return musicUrl;
  z.number().positive().max(600).parse(durationSeconds);
  assertProductionActive();
  const source = assertPathInsideRoot(
    await fs.realpath(projectDir),
    await fs.realpath(
      assertPathInsideRoot(projectDir, path.resolve(projectDir, musicUrl)),
    ),
  );
  const options = {
    signal: productionSignal(),
    timeout: 120_000,
    maxBuffer: 1_048_576,
  };
  const { stdout } = await execute(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "json", source],
    options,
  );
  const probe = z
    .object({
      format: z.object({ duration: z.coerce.number().positive().finite() }),
    })
    .parse(JSON.parse(stdout));
  if (probe.format.duration >= durationSeconds) return musicUrl;
  const directory = path.join(projectDir, "_assets");
  await fs.mkdir(directory, { recursive: true });
  const destination = path.join(directory, "music-continuous.wav");
  const temporary = `${destination}.${randomUUID()}.wav`;
  try {
    await execute(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-y",
        "-stream_loop",
        "-1",
        "-i",
        source,
        "-map",
        "0:a:0",
        "-vn",
        "-t",
        String(durationSeconds),
        "-ar",
        "48000",
        "-c:a",
        "pcm_s16le",
        temporary,
      ],
      options,
    );
    assertProductionActive();
    await fs.rename(temporary, destination);
    return "_assets/music-continuous.wav";
  } finally {
    await fs.rm(temporary, { force: true });
  }
}
