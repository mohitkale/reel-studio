import { execFile } from "node:child_process";
import { promises as fs, createReadStream } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import {
  BALANCED_AUDIO_TARGET,
  audioMasteringReportSchema,
  type AudioMastering,
  type AudioMasteringReport,
} from "@/production/audio-mastering";
import {
  assertProductionActive,
  productionSignal,
} from "@/library/production-cancellation";

const execute = promisify(execFile);
const statsSchema = z.object({
  input_i: z.coerce.number(),
  input_tp: z.coerce.number(),
  input_lra: z.coerce.number(),
  input_thresh: z.coerce.number(),
  target_offset: z.coerce.number(),
});
async function run(command: string, args: string[]) {
  assertProductionActive();
  return execute(command, args, {
    timeout: 120_000,
    maxBuffer: 2 * 1024 * 1024,
    signal: productionSignal(),
  });
}
async function measure(filename: string) {
  const { stderr } = await run("ffmpeg", [
    "-hide_banner",
    "-nostdin",
    "-i",
    filename,
    "-map",
    "0:a:0",
    "-af",
    "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json",
    "-f",
    "null",
    "-",
  ]);
  const match = stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
  if (!match) throw new Error("Audio loudness measurement was not returned.");
  const parsed = statsSchema.safeParse(JSON.parse(match[0]));
  // Silence/very short clips produce -inf or invalid gating values. They stay
  // untouched; these cannot honestly be reported as a verified loudness target.
  if (
    !parsed.success ||
    Object.values(parsed.data).some((value) => !Number.isFinite(value))
  )
    return null;
  return parsed.data;
}
function measurement(stats: NonNullable<Awaited<ReturnType<typeof measure>>>) {
  return {
    integratedLufs: stats.input_i,
    truePeakDbtp: stats.input_tp,
    loudnessRangeLu: stats.input_lra,
    thresholdLufs: stats.input_thresh,
  };
}
function meetsTarget(stats: Awaited<ReturnType<typeof measure>>) {
  return Boolean(
    stats &&
    Math.abs(stats.input_i - BALANCED_AUDIO_TARGET.integratedLufs) <= 1 &&
    stats.input_tp <= BALANCED_AUDIO_TARGET.maxTruePeakDbtp,
  );
}
function normalizationFilter(
  stats: NonNullable<Awaited<ReturnType<typeof measure>>>,
  peak = -1.5,
) {
  const range = Math.min(
    50,
    Math.max(BALANCED_AUDIO_TARGET.loudnessRangeLu, stats.input_lra),
  );
  return `loudnorm=I=-16:TP=${peak}:LRA=${range}:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true`;
}
async function finishAudio(
  source: string,
  destination: string,
  filter: string,
) {
  // loudnorm can add a filter tail. Bound each pass to the unchanged video
  // stream so a correction cannot extend delivery or accumulate AAC padding.
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=duration",
    "-of",
    "json",
    source,
  ]);
  const duration = z
    .object({
      streams: z
        .array(
          z.object({
            duration: z.coerce.number().finite().positive(),
          }),
        )
        .length(1),
    })
    .parse(JSON.parse(stdout)).streams[0].duration;
  await run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-nostdin",
    "-y",
    "-i",
    source,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0",
    "-map_metadata",
    "0",
    "-c:v",
    "copy",
    "-af",
    // Freeze a continuous sample clock through buffered loudnorm passes. Honor
    // intentional source offsets as silence, then reset filter output timestamps
    // and pad to the exact video endpoint before AAC encoding.
    `aresample=48000:async=1:first_pts=0,${filter},asetpts=N/SR/TB,apad`,
    "-ar",
    "48000",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-t",
    String(duration),
    "-movflags",
    "+faststart",
    destination,
  ]);
}
export function audioMasteringReportPath(filename: string) {
  return `${filename}.audio.json`;
}

/** Finish the complete mix once, then measure the encoded AAC delivery.
 * Video packets are copied. Failed/canceled finishing never replaces the source.
 */
export async function masterVideoAudio(
  filename: string,
  mode: AudioMastering = "original",
): Promise<AudioMasteringReport | undefined> {
  assertProductionActive();
  const reportPath = audioMasteringReportPath(filename);
  if (mode === "original") {
    await fs.rm(reportPath, { force: true });
    return undefined;
  }
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "a:0",
    "-show_entries",
    "stream=index",
    "-of",
    "json",
    filename,
  ]);
  const probe = z
    .object({ streams: z.array(z.object({ index: z.number().int() })) })
    .parse(JSON.parse(stdout));
  const before = probe.streams.length ? await measure(filename) : null;
  const temporary = `${filename}.${randomUUID()}.master.mp4`;
  const correction = `${filename}.${randomUUID()}.correction.mp4`;
  const reportTemporary = `${reportPath}.${randomUUID()}.tmp`;
  try {
    let after: typeof before = null;
    if (before) {
      // Leave headroom for AAC reconstruction overshoot. Re-measure the encoded
      // file rather than asserting that filter configuration proves true peak.
      // A lower target range silently forces loudnorm into dynamic mode even
      // with linear=true. Preserve authored quiet holds when constant gain can
      // meet the loudness/peak target; the encoded audit remains authoritative.
      await finishAudio(filename, temporary, normalizationFilter(before));
      after = await measure(temporary);
      // Correct from actual encoded measurements, with a strict bounded retry.
      // Constant gain keeps the envelope when feasible; otherwise the measured
      // limiter pass receives extra AAC headroom. Source video stays untouched.
      for (
        let attempt = 0;
        attempt < 2 && after && !meetsTarget(after);
        attempt++
      ) {
        const gain = Math.min(
          BALANCED_AUDIO_TARGET.integratedLufs - after.input_i,
          -1.5 - after.input_tp,
        );
        const filter =
          Math.abs(
            after.input_i + gain - BALANCED_AUDIO_TARGET.integratedLufs,
          ) <= 0.8
            ? `volume=${gain}dB`
            : normalizationFilter(after, -2.5);
        await finishAudio(temporary, correction, filter);
        after = await measure(correction);
        assertProductionActive();
        await fs.rename(correction, temporary);
      }
      if (!meetsTarget(after))
        throw new Error(
          `Balanced audio could not meet its measured loudness/peak target${after ? ` (${after.input_i} LUFS, ${after.input_tp} dBTP)` : ""}. Keep the current mix or adjust the source audio.`,
        );
    }
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(before ? temporary : filename)) {
      assertProductionActive();
      hash.update(chunk);
    }
    const outputSha256 = hash.digest("hex");
    const report = audioMasteringReportSchema.parse({
      version: 1,
      mode,
      status: before
        ? "verified"
        : probe.streams.length
          ? "unmeasurable"
          : "no-audio",
      target: BALANCED_AUDIO_TARGET,
      before: before ? measurement(before) : null,
      after: after ? measurement(after) : null,
      outputSha256,
    });
    await fs.writeFile(reportTemporary, JSON.stringify(report));
    assertProductionActive();
    await fs.rename(reportTemporary, reportPath);
    assertProductionActive();
    // Commit video last. A report without this exact file hash is never trusted.
    if (before) await fs.rename(temporary, filename);
    return report;
  } finally {
    await fs.rm(temporary, { force: true });
    await fs.rm(correction, { force: true });
    await fs.rm(reportTemporary, { force: true });
  }
}

export async function readAudioMasteringReport(
  filename: string,
  checksum: string,
) {
  try {
    const report = audioMasteringReportSchema.parse(
      JSON.parse(await fs.readFile(audioMasteringReportPath(filename), "utf8")),
    );
    return report.outputSha256 === checksum ? report : undefined;
  } catch {
    return undefined;
  }
}
