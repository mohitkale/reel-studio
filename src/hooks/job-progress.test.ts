import { afterEach, expect, it, vi } from "vitest";
import { waitForJob } from "./job-progress";
class Source {
  static last: Source;
  onmessage?: (e: { data: string }) => void;
  onerror?: () => void;
  close = vi.fn();
  constructor() {
    Source.last = this;
  }
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("closes SSE on deadline even if the connection never errors", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("EventSource", Source);
  const pending = waitForJob("/job", () => undefined, undefined, 10);
  const assertion = expect(pending).rejects.toThrow("timed out");
  await vi.advanceTimersByTimeAsync(10);
  await assertion;
  expect(Source.last.close).toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
it("does not swallow terminal provider errors during fallback polling", async () => {
  vi.stubGlobal("EventSource", Source);
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ job: { status: "error", error: "Quota exhausted" } }),
      ),
  );
  const pending = waitForJob<{ status: string; error: string }, string>(
    "/job",
    (data) => {
      if (data.status === "error") throw new Error(data.error);
      return undefined;
    },
  );
  Source.last.onerror!();
  await expect(pending).rejects.toThrow("Quota exhausted");
  expect(Source.last.close).toHaveBeenCalled();
});
it("closes connections and aborts polling when the editor unmounts", async () => {
  vi.stubGlobal("EventSource", Source);
  const controller = new AbortController();
  const pending = waitForJob("/job", () => undefined, controller.signal);
  controller.abort();
  await expect(pending).rejects.toThrow();
  expect(Source.last.close).toHaveBeenCalledOnce();
});
