// @vitest-environment node
import { expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { extendHyperframesMusic } from "./hyperframes-music-loop";
import { withProductionSignal } from "./production-cancellation";

const execute = promisify(execFile);
it("freezes local music past its source duration and refuses escaped inputs or canceled work", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "reel-music-loop-"),
  );
  try {
    await execute("ffmpeg", [
      "-v",
      "error",
      "-nostdin",
      "-f",
      "lavfi",
      "-i",
      "sine=f=440:r=48000:d=0.2",
      path.join(directory, "source.wav"),
    ]);
    expect(await extendHyperframesMusic(directory, "source.wav", 0.1)).toBe(
      "source.wav",
    );
    const relative = await extendHyperframesMusic(
      directory,
      "source.wav",
      0.65,
    );
    const output = path.join(directory, relative!);
    const { stdout } = await execute("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "json",
      output,
    ]);
    expect(Number(JSON.parse(stdout).format.duration)).toBeCloseTo(0.65, 4);
    const { stderr } = await execute("ffmpeg", [
      "-v",
      "info",
      "-nostdin",
      "-ss",
      "0.5",
      "-i",
      output,
      "-t",
      "0.1",
      "-af",
      "volumedetect",
      "-f",
      "null",
      "-",
    ]);
    expect(
      Number(stderr.match(/mean_volume: ([\d.-]+) dB/)?.[1]),
    ).toBeGreaterThan(-30);
    await expect(
      extendHyperframesMusic(directory, "../escaped.wav", 1),
    ).rejects.toThrow(/storage root/);
    const controller = new AbortController();
    controller.abort(new Error("Canceled"));
    await expect(
      withProductionSignal(controller.signal, () =>
        extendHyperframesMusic(directory, "source.wav", 1),
      ),
    ).rejects.toThrow("Canceled");
    expect(
      (await fs.readdir(path.join(directory, "_assets"))).filter(
        (file) => file !== "music-continuous.wav",
      ),
    ).toEqual([]);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
