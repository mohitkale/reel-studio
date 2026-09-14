import {
  assertProductionActive,
  cancelChild,
} from "@/library/production-cancellation";
import { spawn } from "node:child_process";

import { normalizeWavLoudness } from "@/lib/audio-normalize";
import { parseWav } from "@/lib/wav";

export interface WavAnalysis {
  durationSeconds: number;
  peakDbfs: number | null;
  rmsDbfs: number | null;
  activeSampleRatio: number;
  clipped: boolean;
}

const SILENCE_FLOOR = 0.005;

function linearToDb(value: number): number | null {
  return value > 0 ? 20 * Math.log10(value) : null;
}

export function analyzeWav(wav: Buffer): WavAnalysis {
  const info = parseWav(wav);
  if (info.bitsPerSample !== 16) {
    throw new Error("Audio production requires 16-bit PCM WAV input");
  }
  const pcm = wav.subarray(info.dataOffset, info.dataOffset + info.dataLength);
  const sampleCount = Math.floor(pcm.length / 2);
  let peak = 0;
  let sumSquares = 0;
  let active = 0;
  for (let i = 0; i < sampleCount; i++) {
    const sample = pcm.readInt16LE(i * 2) / 32768;
    const absolute = Math.abs(sample);
    peak = Math.max(peak, absolute);
    if (absolute >= SILENCE_FLOOR) {
      sumSquares += sample * sample;
      active += 1;
    }
  }
  const rms = active > 0 ? Math.sqrt(sumSquares / active) : 0;
  return {
    durationSeconds: info.durationSeconds,
    peakDbfs: linearToDb(peak),
    rmsDbfs: linearToDb(rms),
    activeSampleRatio: sampleCount > 0 ? active / sampleCount : 0,
    clipped: peak >= 0.999,
  };
}

/** Normalize a spoken master and reject corrupt, empty, clipped, or silent output. */
export function finalizeSpeechWav(
  wav: Buffer,
  options: { expectedSpeech?: boolean } = {},
): { wav: Buffer; analysis: WavAnalysis } {
  const normalized = normalizeWavLoudness(wav);
  const analysis = analyzeWav(normalized);
  if (analysis.durationSeconds <= 0.05) {
    throw new Error("Generated audio is empty");
  }
  if (analysis.clipped) {
    throw new Error("Generated audio clips at full scale");
  }
  if (options.expectedSpeech !== false && analysis.activeSampleRatio < 0.001) {
    throw new Error("Generated audio contains unexpected silence");
  }
  return { wav: normalized, analysis };
}

/** Shell-free WAV → 192 kbps MP3 conversion for local production exports. */
export async function transcodeWavToMp3(
  wav: Buffer,
  binary = process.env.FFMPEG_BIN?.trim() || "ffmpeg",
): Promise<Buffer> {
  assertProductionActive();
  return new Promise((resolve, reject) => {
    const child = spawn(
      binary,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "wav",
        "-i",
        "pipe:0",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        "192k",
        "-f",
        "mp3",
        "pipe:1",
      ],
      {
        shell: false,
        detached: process.platform !== "win32",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    cancelChild(child);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.reduce((size, item) => size + item.length, 0) < 16_384) {
        stderr.push(chunk);
      }
    });
    child.once("error", (error) => reject(error));
    child.once("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `MP3 export failed${stderr.length ? `: ${Buffer.concat(stderr).toString("utf8").trim()}` : ""}`,
          ),
        );
        return;
      }
      const result = Buffer.concat(stdout);
      if (result.length === 0) {
        reject(new Error("MP3 export produced an empty file"));
        return;
      }
      resolve(result);
    });
    child.stdin.on("error", () => undefined);
    child.stdin.end(wav);
  });
}
