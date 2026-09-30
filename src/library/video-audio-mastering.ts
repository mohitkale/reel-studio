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
  const reportTemporary = `${reportPath}.${randomUUID()}.tmp`;
  try {
    let after: typeof before = null;
    if (before) {
      // Leave headroom for AAC reconstruction overshoot. Re-measure the encoded
      // file rather than asserting that filter configuration proves true peak.
      const filter = `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${before.input_i}:measured_TP=${before.input_tp}:measured_LRA=${before.input_lra}:measured_thresh=${before.input_thresh}:offset=${before.target_offset}:linear=true`;
      await run("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-y",
        "-i",
        filename,
        "-map",
        "0:v:0",
        "-map",
        "0:a:0",
        "-map_metadata",
        "0",
        "-c:v",
        "copy",
        "-af",
        filter,
        "-ar",
        "48000",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        temporary,
      ]);
      after = await measure(temporary);
      if (
        !after ||
        Math.abs(after.input_i - BALANCED_AUDIO_TARGET.integratedLufs) > 1 ||
        after.input_tp > BALANCED_AUDIO_TARGET.maxTruePeakDbtp
      )
        throw new Error(
          "Balanced audio could not meet its measured loudness/peak target. Keep the current mix or adjust the source audio.",
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
