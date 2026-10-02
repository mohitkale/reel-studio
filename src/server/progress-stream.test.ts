// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { progressResponse } from "./progress-stream";
afterEach(() => vi.useRealTimers());
describe("durable progress SSE lifecycle", () => {
  it("sends terminal state on reconnect without installing a timer", async () => {
    vi.useFakeTimers();
    const read = vi.fn();
    const response = progressResponse(
      new Request("http://localhost"),
      { status: "done" },
      read,
      (j) => j.status === "done",
    );
    expect(await response.text()).toContain('"done"');
    expect(vi.getTimerCount()).toBe(0);
    expect(read).not.toHaveBeenCalled();
  });
  it.each(["abort", "cancel", "terminal"])(
    "cleans up after %s, including pending reads",
    async (action) => {
      vi.useFakeTimers();
      const signal = new AbortController();
      let resolve!: (value: { status: string }) => void;
      const read = vi.fn(
        () =>
          new Promise<{ status: string }>((r) => {
            resolve = r;
          }),
      );
      const response = progressResponse(
        new Request("http://localhost", { signal: signal.signal }),
        { status: "running" },
        read,
        (j) => j.status === "done",
      );
      const reader = response.body!.getReader();
      await reader.read();
      await vi.advanceTimersByTimeAsync(1000);
      if (action === "abort") signal.abort();
      if (action === "cancel") await reader.cancel();
      resolve({ status: "done" });
      await vi.advanceTimersByTimeAsync(0);
      if (action === "terminal")
        expect(new TextDecoder().decode((await reader.read()).value)).toContain(
          '"done"',
        );
      expect((await reader.read()).done).toBe(true);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(read).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    },
  );
  it("does not enqueue an unlimited backlog for a stalled consumer", async () => {
    vi.useFakeTimers();
    let n = 0;
    const response = progressResponse(
      new Request("http://localhost"),
      { n },
      async () => ({ n: ++n }),
      () => false,
    );
    await vi.advanceTimersByTimeAsync(10_000);
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain(
      '"n":0',
    );
    await vi.advanceTimersByTimeAsync(1000);
    expect(new TextDecoder().decode((await reader.read()).value)).toContain(
      '"n":11',
    );
    await reader.cancel();
    expect(vi.getTimerCount()).toBe(0);
  });
});
