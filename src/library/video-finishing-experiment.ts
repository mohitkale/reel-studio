import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import {
  finishingExperimentSchema,
  TEMPORAL_BLEND_FILTER,
  type FinishingExperiment,
} from "@/production/video-benchmark";
import { planRenderSections } from "@/production/render-sections";
import { hashRenderFile } from "@/library/render-section-cache";
const execute = promisify(execFile);
const probeSchema = z.object({
  streams: z.array(
    z.object({
      codec_type: z.string(),
      width: z.number().optional(),
      height: z.number().optional(),
      nb_read_packets: z.coerce.number().int().optional(),
      avg_frame_rate: z.string().optional(),
    }),
  ),
  format: z.object({ duration: z.coerce.number() }),
});
async function probe(filename: string, signal?: AbortSignal) {
  const result = await execute(
    "ffprobe",
    [
      "-v",
      "error",
      "-count_packets",
      "-show_entries",
      "stream=codec_type,width,height,nb_read_packets,avg_frame_rate:format=duration",
      "-of",
      "json",
      filename,
    ],
    { signal, timeout: 30_000 },
  );
  return probeSchema.parse(JSON.parse(result.stdout));
}
async function audioHash(filename: string, signal?: AbortSignal) {
  return (
    await execute(
      "ffmpeg",
      [
        "-v",
        "error",
        "-nostdin",
        "-i",
        filename,
        "-map",
        "0:a:0",
        "-c",
        "copy",
        "-f",
        "hash",
        "-hash",
        "sha256",
        "-",
      ],
      { signal, timeout: 30_000 },
    )
  ).stdout.trim();
}
/** Explicit offline experiment only. Three encoded frames are blended; this is
 * causal temporal smoothing, not subframe exposure or a production motion-blur
 * renderer. It can soften moving copy. History resets at every authored cut.
 * Default production render paths never invoke this function.
 */
export async function finishVideoExperiment(
  source: string,
  output: string,
  raw: FinishingExperiment,
  signal?: AbortSignal,
) {
  const input = finishingExperimentSchema.parse(raw);
  if (path.resolve(source) === path.resolve(output))
    throw new Error("Finishing requires a separate output.");
  signal?.throwIfAborted();
  const sourceSha256 = await hashRenderFile(source);
  const before = await probe(source, signal);
  const video = before.streams.find((stream) => stream.codec_type === "video");
  if (
    !video ||
    video.nb_read_packets !== input.totalFrames ||
    video.avg_frame_rate !== `${input.fps}/1`
  )
    throw new Error(
      "Source coverage or frame rate differs from the finishing request.",
    );
  await fs.mkdir(path.dirname(output), { recursive: true });
  // Reserve the output so existing artifacts are never overwritten.
  const reservation = await fs.open(output, "wx");
  await reservation.close();
  let directory: string | undefined;
  let committed = false;
  const started = performance.now();
  try {
    directory = await fs.mkdtemp(
      path.join(path.dirname(output), ".finishing-"),
    );
    const sections = planRenderSections(
      input.totalFrames,
      input.fps,
      input.cutFrames,
    );
    const pieces: string[] = [];
    for (const section of sections) {
      signal?.throwIfAborted();
      const piece = path.join(directory, `${section.index}.mp4`);
      await execute(
        "ffmpeg",
        [
          "-v",
          "error",
          "-nostdin",
          "-ss",
          String(section.startFrame / input.fps),
          "-i",
          source,
          "-frames:v",
          String(section.endFrame - section.startFrame + 1),
          "-an",
          "-vf",
          TEMPORAL_BLEND_FILTER,
          "-c:v",
          "libx264",
          "-preset",
          "medium",
          "-crf",
          "16",
          "-pix_fmt",
          "yuv420p",
          "-r",
          String(input.fps),
          "-g",
          String(input.fps),
          "-flags",
          "+cgop",
          piece,
        ],
        { signal, timeout: 20 * 60_000, maxBuffer: 1024 * 1024 },
      );
      pieces.push(piece);
    }
    const list = path.join(directory, "pieces.txt");
    await fs.writeFile(
      list,
      pieces
        .map((piece) => `file '${piece.replaceAll("'", "'\\''")}'`)
        .join("\n"),
    );
    const pending = path.join(directory, "finished.mp4");
    await execute(
      "ffmpeg",
      [
        "-v",
        "error",
        "-nostdin",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        list,
        "-i",
        source,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0?",
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        pending,
      ],
      { signal, timeout: 120_000 },
    );
    const after = await probe(pending, signal);
    const finished = after.streams.find(
      (stream) => stream.codec_type === "video",
    );
    if (
      finished?.nb_read_packets !== input.totalFrames ||
      finished.width !== video.width ||
      finished.height !== video.height ||
      finished.avg_frame_rate !== video.avg_frame_rate ||
      Math.abs(after.format.duration - before.format.duration) > 1 / input.fps
    )
      throw new Error(
        "Finishing changed frame coverage, dimensions or duration.",
      );
    const hasAudio = before.streams.some(
      (stream) => stream.codec_type === "audio",
    );
    if (
      hasAudio !==
        after.streams.some((stream) => stream.codec_type === "audio") ||
      (hasAudio &&
        (await audioHash(source, signal)) !==
          (await audioHash(pending, signal)))
    )
      throw new Error("Finishing changed the encoded audio stream.");
    signal?.throwIfAborted();
    if ((await hashRenderFile(source)) !== sourceSha256)
      throw new Error("Source changed during finishing.");
    const report = {
      mode: input.mode,
      samples: 3,
      sections: sections.length,
      milliseconds: performance.now() - started,
      secondsPerVideoMinute:
        (performance.now() - started) /
        1000 /
        (input.totalFrames / input.fps / 60),
      sourceSha256,
      outputSha256: await hashRenderFile(pending),
      audioPacketsUnchanged: true,
      dimensions: [video.width, video.height],
      totalFrames: input.totalFrames,
      fps: input.fps,
      caveat:
        "Causal temporal smoothing can soften moving text and introduce a one-frame visual lag; it is not subframe motion blur.",
    };
    signal?.throwIfAborted();
    await fs.rename(pending, output);
    committed = true;
    return report;
  } finally {
    if (directory) await fs.rm(directory, { recursive: true, force: true });
    if (!committed) await fs.rm(output, { force: true });
  }
}
