// @vitest-environment node
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import { finishVideoExperiment } from "./video-finishing-experiment";
import { finishingExperimentSchema } from "@/production/video-benchmark";
const execute = promisify(execFile);
it("preserves exact coverage and encoded audio, resets temporal history at cuts and protects existing artifacts", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "reel-finish-proof-"));
  const source = path.join(root, "source.mp4"),
    output = path.join(root, "finished.mp4");
  const input = {
    mode: "temporal-blend-3" as const,
    quality: "high" as const,
    fps: 24 as const,
    totalFrames: 72,
    cutFrames: [24],
  };
  try {
    await execute("ffmpeg", [
      "-v",
      "error",
      "-nostdin",
      "-f",
      "lavfi",
      "-i",
      "color=red:size=160x90:rate=24:duration=1",
      "-f",
      "lavfi",
      "-i",
      "color=lime:size=160x90:rate=24:duration=2",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=3",
      "-filter_complex",
      "[0:v][1:v]concat=n=2:v=1:a=0[v]",
      "-map",
      "[v]",
      "-map",
      "2:a",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      source,
    ]);
    const result = await finishVideoExperiment(source, output, input);
    expect(result.audioPacketsUnchanged).toBe(true);
    expect(result.totalFrames).toBe(72);
    expect(result.outputSha256).not.toBe(result.sourceSha256);
    const pixel = await execute(
      "ffmpeg",
      [
        "-v",
        "error",
        "-nostdin",
        "-ss",
        "1",
        "-i",
        output,
        "-frames:v",
        "1",
        "-vf",
        "scale=1:1",
        "-pix_fmt",
        "rgb24",
        "-f",
        "rawvideo",
        "-",
      ],
      { encoding: "buffer" },
    );
    expect(pixel.stdout[1]).toBeGreaterThan(200);
    expect(pixel.stdout[0]).toBeLessThan(20); // no red ghost from the outgoing scene
    await expect(finishVideoExperiment(source, source, input)).rejects.toThrow(
      "separate output",
    );
    const before = await fs.readFile(output);
    await expect(
      finishVideoExperiment(source, output, input),
    ).rejects.toThrow();
    expect(await fs.readFile(output)).toEqual(before);
    const canceled = path.join(root, "canceled.mp4");
    const controller = new AbortController();
    const pending = finishVideoExperiment(
      source,
      canceled,
      input,
      controller.signal,
    );
    setTimeout(() => controller.abort(), 200);
    await expect(pending).rejects.toThrow();
    expect(await fs.readdir(root)).toEqual(
      expect.arrayContaining(["source.mp4", "finished.mp4"]),
    );
    expect(
      (await fs.readdir(root)).some(
        (file) => file.startsWith(".finishing-") || file === "canceled.mp4",
      ),
    ).toBe(false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}, 30_000);
it("requires explicit high quality and bounded, ordered timing", () => {
  const input = {
    mode: "temporal-blend-3",
    quality: "high",
    fps: 24,
    totalFrames: 7200,
    cutFrames: [720],
  };
  expect(finishingExperimentSchema.safeParse(input).success).toBe(true);
  for (const changes of [
    { quality: "standard" },
    { totalFrames: 7201 },
    { cutFrames: [24, 24] },
    { cutFrames: [72, 24] },
    { cutFrames: [7200] },
  ])
    expect(
      finishingExperimentSchema.safeParse({ ...input, ...changes }).success,
    ).toBe(false);
});
