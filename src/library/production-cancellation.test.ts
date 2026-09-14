// @vitest-environment node
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  cancelChild,
  withProductionSignal,
  assertProductionActive,
  cancelableRemotion,
} from "./production-cancellation";

describe("active production cancellation", () => {
  it("terminates an active FFmpeg process before cleanup", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "reel-cancel-"));
    const controller = new AbortController();
    const file = path.join(dir, "partial.wav");
    const child = spawn(
      "ffmpeg",
      [
        "-v",
        "error",
        "-re",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440",
        "-flush_packets",
        "1",
        file,
      ],
      { detached: process.platform !== "win32", stdio: "ignore" },
    );
    const closed = once(child, "close");
    cancelChild(child, controller.signal, 100);
    try {
      await expect
        .poll(async () => (await readFile(file)).length)
        .toBeGreaterThan(0);
      controller.abort();
      await closed;
      expect(() => process.kill(child.pid!, 0)).toThrow();
    } finally {
      controller.abort();
      await closed;
      await rm(dir, { recursive: true, force: true });
    }
    await expect(readFile(file)).rejects.toThrow();
  });
  it("kills a stubborn process group with a bounded timeout", async () => {
    const controller = new AbortController();
    const child = spawn(
      process.execPath,
      [
        "-e",
        "process.on('SIGTERM',()=>{}); console.log('ready'); setInterval(()=>{},1000)",
      ],
      {
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const closed = once(child, "close");
    cancelChild(child, controller.signal, 100);
    await once(child.stdout!, "data");
    controller.abort();
    const [, signal] = await closed;
    expect(signal).toBe("SIGKILL");
    expect(() => process.kill(child.pid!, 0)).toThrow();
  });
  it("prevents new work after abort and bridges the Remotion signal", async () => {
    const controller = new AbortController();
    const operation = withProductionSignal(controller.signal, () =>
      cancelableRemotion(async (signal) => {
        await new Promise<void>((resolve) => signal(() => resolve()));
      }),
    );
    controller.abort();
    await expect(operation).rejects.toThrow();
    expect(() =>
      withProductionSignal(controller.signal, () => assertProductionActive()),
    ).toThrow();
  });
});
