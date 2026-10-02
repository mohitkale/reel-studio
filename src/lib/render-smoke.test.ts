// @vitest-environment node
import { describe, it, expect } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { renderHyperframesAudiogram } from "@/library/hyperframes-audiogram";
import { pcmToWav } from "@/lib/wav";
import type { PodcastAudiogramPlan } from "@/library/podcast-audiogram";

const execute = promisify(execFile);
describe.skipIf(process.env.SKIP_RENDER_SMOKE === "1")("render smoke", () => {
  it(
    "exports a seekable HyperFrames audiogram with the original audio",
    { timeout: 300_000 },
    async () => {
      const directory = await fs.mkdtemp(
        path.join(os.tmpdir(), "reel-hf-smoke-"),
      );
      const pcm = Buffer.alloc(24_000 * 2 * 3);
      for (let index = 0; index < pcm.length / 2; index++)
        pcm.writeInt16LE(
          Math.round(Math.sin((index * 2 * Math.PI * 440) / 24_000) * 8000),
          index * 2,
        );
      const wav = pcmToWav(pcm, {
        sampleRate: 24_000,
        channels: 1,
        bitsPerSample: 16,
      });
      const plan: PodcastAudiogramPlan = {
        wav,
        startFrame: 0,
        endFrame: 90,
        selectedTurnIds: ["a", "b"],
        props: {
          title: "A clear conversation",
          presetLabel: "Explainer",
          audioUrl: "audio.wav",
          width: 1080,
          height: 1920,
          fps: 30,
          durationInFrames: 90,
          colors: {
            background: "#111827",
            foreground: "#ffffff",
            muted: "#9ca3af",
            accent: "#38bdf8",
          },
          waveform: Array.from(
            { length: 48 },
            (_, index) => 0.15 + (index % 7) / 10,
          ),
          beats: [
            {
              turnId: "a",
              speaker: "Host",
              text: "One original recording.",
              startFrame: 0,
              durationFrames: 45,
            },
            {
              turnId: "b",
              speaker: "Guest",
              text: "Two timed speaker cards.",
              startFrame: 45,
              durationFrames: 45,
            },
          ],
        },
      };
      try {
        const output = path.join(directory, "smoke.mp4");
        await renderHyperframesAudiogram(
          plan,
          output,
          "draft",
          new AbortController().signal,
        );
        expect((await fs.stat(output)).size).toBeGreaterThan(10_000);
        const { stdout } = await execute("ffprobe", [
          "-v",
          "error",
          "-show_entries",
          "stream=codec_type,codec_name,width,height",
          "-show_entries",
          "format=duration",
          "-of",
          "json",
          output,
        ]);
        const metadata = JSON.parse(stdout);
        expect(
          metadata.streams.some(
            (stream: { codec_type: string; codec_name: string }) =>
              stream.codec_type === "audio" && stream.codec_name === "aac",
          ),
        ).toBe(true);
        expect(Number(metadata.format.duration)).toBeCloseTo(3, 1);
        expect(
          metadata.streams.find(
            (stream: { codec_type: string }) => stream.codec_type === "video",
          ),
        ).toMatchObject({ codec_name: "h264", width: 1080, height: 1920 });
      } finally {
        await fs.rm(directory, { recursive: true, force: true });
      }
    },
  );
});
