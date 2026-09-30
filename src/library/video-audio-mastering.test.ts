// @vitest-environment node
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import {
  masterVideoAudio,
  readAudioMasteringReport,
  audioMasteringReportPath,
} from "@/library/video-audio-mastering";
import { withProductionSignal } from "@/library/production-cancellation";
import { createHash } from "node:crypto";

const run = promisify(execFile);
async function fixture(filename: string, audio?: string) {
  await run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=navy:s=320x180:r=15:d=6",
    ...(audio ? ["-f", "lavfi", "-i", audio] : []),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    ...(audio ? ["-c:a", "aac", "-shortest"] : []),
    filename,
  ]);
}
async function videoHash(filename: string) {
  return (
    await run("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      filename,
      "-map",
      "0:v:0",
      "-c:v",
      "copy",
      "-f",
      "hash",
      "-",
    ])
  ).stdout.trim();
}
it("measures real encoded audio, preserves video packets, and rejects stale audit reports", async () => {
  const directory = await fs.mkdtemp(path.join(tmpdir(), "reel-mastering-"));
  try {
    const file = path.join(directory, "mix.mp4");
    await fixture(file, "sine=frequency=440:sample_rate=48000:duration=6");
    const before = await videoHash(file);
    const report = await masterVideoAudio(file, "balanced");
    expect(report?.status).toBe("verified");
    expect(report?.after?.integratedLufs).toBeCloseTo(-16, 0);
    expect(report?.after?.truePeakDbtp).toBeLessThanOrEqual(-1);
    expect(await videoHash(file)).toBe(before);
    const { stdout } = await run("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_type,codec_name,width,height,duration,nb_frames",
      "-of",
      "json",
      file,
    ]);
    const streams = JSON.parse(stdout).streams;
    expect(
      streams.find(
        (stream: { codec_type: string }) => stream.codec_type === "video",
      ),
    ).toMatchObject({
      codec_name: "h264",
      width: 320,
      height: 180,
      nb_frames: "90",
    });
    expect(
      Number(
        streams.find(
          (stream: { codec_type: string }) => stream.codec_type === "audio",
        ).duration,
      ),
    ).toBeCloseTo(6, 1);
    expect(await readAudioMasteringReport(file, report!.outputSha256)).toEqual(
      report,
    );
    expect(
      await readAudioMasteringReport(file, "0".repeat(64)),
    ).toBeUndefined();
    const masteredBytes = await fs.readFile(file);
    await masterVideoAudio(file, "original");
    expect(await fs.readFile(file)).toEqual(masteredBytes);
    await expect(
      fs.access(audioMasteringReportPath(file)),
    ).rejects.toBeDefined();
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}, 20_000);
it("leaves silent and audio-free media unchanged and safely cancels finishing", async () => {
  const directory = await fs.mkdtemp(
    path.join(tmpdir(), "reel-mastering-silent-"),
  );
  try {
    for (const audio of [undefined, "anullsrc=r=48000:cl=stereo:d=6"]) {
      const file = path.join(directory, audio ? "silent.mp4" : "no-audio.mp4");
      await fixture(file, audio);
      const bytes = await fs.readFile(file);
      const report = await masterVideoAudio(file, "balanced");
      expect(report).toMatchObject({
        status: audio ? "unmeasurable" : "no-audio",
        before: null,
        after: null,
        outputSha256: createHash("sha256").update(bytes).digest("hex"),
      });
      expect(await fs.readFile(file)).toEqual(bytes);
      const controller = new AbortController();
      controller.abort();
      await expect(
        withProductionSignal(controller.signal, () =>
          masterVideoAudio(file, "balanced"),
        ),
      ).rejects.toMatchObject({ name: "AbortError" });
      expect(await fs.readFile(file)).toEqual(bytes);
    }
    expect(
      (await fs.readdir(directory)).filter(
        (name) => name.includes(".master.") || name.endsWith(".tmp"),
      ),
    ).toEqual([]);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}, 20_000);
