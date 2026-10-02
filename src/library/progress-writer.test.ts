// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { createProgressWriter } from "./progress-writer";
afterEach(() => vi.useRealTimers());
it("coalesces a burst and flushes the final value before completion", async () => {
  vi.useFakeTimers();
  const write = vi.fn(async (value: number) => {
    void value;
  });
  const writer = createProgressWriter(write);
  for (let i = 0; i < 1000; i++) writer.push(i);
  await vi.advanceTimersByTimeAsync(0);
  expect(write).toHaveBeenCalledTimes(1);
  for (let i = 1000; i < 2000; i++) writer.push(i);
  await vi.advanceTimersByTimeAsync(249);
  expect(write).toHaveBeenCalledTimes(1);
  await writer.flush();
  expect(write).toHaveBeenLastCalledWith(1999);
  expect(write).toHaveBeenCalledTimes(2);
  await writer.stop();
  await vi.advanceTimersByTimeAsync(1000);
  expect(write).toHaveBeenCalledTimes(2);
});
it("serializes writes, discards canceled pending updates and surfaces write failures", async () => {
  let release!: () => void;
  const write = vi.fn(
    () =>
      new Promise<void>((r) => {
        release = r;
      }),
  );
  const writer = createProgressWriter(write);
  writer.push(1, true);
  await Promise.resolve();
  writer.push(2);
  const stopped = writer.stop();
  release();
  await stopped;
  expect(write).toHaveBeenCalledTimes(1);
  const failed = createProgressWriter(async () => {
    throw new Error("disk full");
  });
  failed.push(1, true);
  await expect(failed.flush()).rejects.toThrow("disk full");
  await failed.stop();
});

it("allows a newer successful snapshot to supersede a failed progress write", async () => {
  const write = vi
    .fn()
    .mockRejectedValueOnce(new Error("database is locked"))
    .mockResolvedValue(undefined);
  const writer = createProgressWriter<number>(write);
  writer.push(1, true);
  await expect(writer.flush()).rejects.toThrow("locked");
  writer.push(2, true);
  await writer.flush();
  await writer.stop();
  expect(write).toHaveBeenLastCalledWith(2);
});
