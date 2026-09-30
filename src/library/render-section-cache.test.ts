// @vitest-environment node
import { expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  pruneRenderSectionCache,
  renderCachedSection,
  renderCacheKey,
  assembleRenderSections,
} from "./render-section-cache";
import { withProductionSignal } from "./production-cancellation";
const execute = promisify(execFile);
it("reuses only verified sections, rejects partial coverage and cleans cancellation while keeping completed work", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "reel's section cache-"),
  );
  try {
    const source = path.join(directory, "source.mp4");
    await execute("ffmpeg", [
      "-v",
      "error",
      "-nostdin",
      "-f",
      "lavfi",
      "-i",
      "color=c=purple:s=64x64:r=30",
      "-frames:v",
      "3",
      "-an",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      source,
    ]);
    const section = { index: 0, startFrame: 0, endFrame: 2 };
    const key = renderCacheKey({ source: "frozen", version: 1 });
    const render = vi.fn(async (filename: string) => {
      await fs.copyFile(source, filename);
    });
    const input = {
      root: directory,
      key,
      section,
      render,
      temporaryDirectory: path.join(directory, "scratch"),
    };
    const result = await renderCachedSection(input);
    expect(result.reused).toBe(false);
    expect((await renderCachedSection(input)).reused).toBe(true);
    expect(render).toHaveBeenCalledTimes(1);
    await fs.writeFile(result.filename, "corrupt");
    expect((await renderCachedSection(input)).reused).toBe(false);
    expect(render).toHaveBeenCalledTimes(2);
    await expect(
      renderCachedSection({
        ...input,
        section: { index: 1, startFrame: 3, endFrame: 6 },
      }),
    ).rejects.toThrow(/coverage/);
    const cancellation = new AbortController();
    await expect(
      withProductionSignal(cancellation.signal, () =>
        renderCachedSection({
          ...input,
          section: { index: 1, startFrame: 3, endFrame: 5 },
          render: async (filename) => {
            await fs.copyFile(source, filename);
            cancellation.abort(new Error("Canceled"));
          },
        }),
      ),
    ).rejects.toThrow("Canceled");
    expect((await renderCachedSection(input)).reused).toBe(true);
    const files = await fs.readdir(path.join(directory, key));
    expect(files).toEqual(["section-0.mp4", "section-0.mp4.json"]);
    expect(await fs.readdir(input.temporaryDirectory)).toEqual([]);
    const audio = path.join(directory, "mix.wav");
    await execute("ffmpeg", [
      "-v",
      "error",
      "-nostdin",
      "-f",
      "lavfi",
      "-i",
      "sine=f=440:r=48000:d=1",
      audio,
    ]);
    const output = path.join(directory, "assembled.mp4");
    await assembleRenderSections(
      [result.filename, result.filename],
      audio,
      output,
      6,
      30,
    );
    const { stdout } = await execute("ffprobe", [
      "-v",
      "error",
      "-count_packets",
      "-show_entries",
      "stream=codec_type,nb_read_packets:format=duration",
      "-of",
      "json",
      output,
    ]);
    const probe = JSON.parse(stdout);
    expect(
      probe.streams.find(
        (stream: { codec_type: string }) => stream.codec_type === "video",
      ).nb_read_packets,
    ).toBe("6");
    expect(
      probe.streams.some(
        (stream: { codec_type: string }) => stream.codec_type === "audio",
      ),
    ).toBe(true);
    expect(Number(probe.format.duration)).toBeCloseTo(0.2, 2);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

it("prunes expired generated caches while protecting recent and current retry work", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "reel-section-retention-"),
  );
  try {
    const keys = ["a".repeat(64), "b".repeat(64), "c".repeat(64)];
    for (const key of keys) {
      await fs.mkdir(path.join(directory, key));
      await fs.writeFile(path.join(directory, key, "section-0.mp4"), "fixture");
    }
    const expired = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await fs.utimes(path.join(directory, keys[0]), expired, expired);
    await fs.utimes(path.join(directory, keys[1]), expired, expired);
    await fs.mkdir(path.join(directory, "user-files"));
    await pruneRenderSectionCache(directory, keys[1]);
    expect((await fs.readdir(directory)).sort()).toEqual(
      [keys[1], keys[2], "user-files"].sort(),
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
