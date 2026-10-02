// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithDeadline } from "./deadline-fetch";
import { providerFetch } from "@/providers/voice/http";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("provider deadlines", () => {
  it("bounds headers even when a transport ignores AbortSignal", async () => {
    vi.stubGlobal("fetch", () => new Promise(() => {}));
    await expect(
      fetchWithDeadline("https://fixture.test", {}, 10),
    ).rejects.toMatchObject({ name: "TimeoutError" });
  });
  it("bounds a stalled body even with a caller signal and maps its timeout", async () => {
    const cancel = vi.fn();
    vi.stubGlobal(
      "fetch",
      async () => new Response(new ReadableStream({ cancel })),
    );
    const res = await providerFetch(
      "https://fixture.test",
      { signal: new AbortController().signal },
      "cartesia",
      { timeoutMs: 10 },
    );
    await expect(res.text()).rejects.toMatchObject({ status: 504 });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("releases an unread body when its deadline expires", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    vi.stubGlobal(
      "fetch",
      async () => new Response(new ReadableStream({ cancel })),
    );
    const res = await fetchWithDeadline("https://fixture.test", {}, 10);
    await vi.advanceTimersByTimeAsync(10);
    expect(cancel).toHaveBeenCalledOnce();
    await expect(res.text()).rejects.toMatchObject({ name: "TimeoutError" });
    expect(vi.getTimerCount()).toBe(0);
  });
  it("preserves explicit cancellation and clears the deadline", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", async () => new Response(new ReadableStream()));
    const caller = new AbortController();
    const res = await providerFetch(
      "https://fixture.test",
      { signal: caller.signal },
      "cartesia",
    );
    const error = new Error("user canceled");
    caller.abort(error);
    await expect(res.text()).rejects.toBe(error);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("clears the timer on completion and downstream cancellation", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", async () => new Response("ok"));
    expect(await (await fetchWithDeadline("https://fixture.test")).text()).toBe(
      "ok",
    );
    expect(vi.getTimerCount()).toBe(0);
    await (await fetchWithDeadline("https://fixture.test")).body!.cancel();
    expect(vi.getTimerCount()).toBe(0);
  });
});

it("cancels over-sized responses without accumulating their entire body", async () => {
  const chunk = new Uint8Array(8 * 1024 * 1024);
  const cancel = vi.fn();
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.enqueue(chunk);
          },
          cancel,
        }),
      ),
  );
  const reader = (
    await fetchWithDeadline("https://fixture.test")
  ).body!.getReader();
  for (let i = 0; i < 16; i++) expect((await reader.read()).done).toBe(false);
  await expect(reader.read()).rejects.toThrow("exceeds 128 MiB");
  expect(cancel).toHaveBeenCalledOnce();
});
it("does not start a request for an already canceled caller", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const caller = new AbortController();
  caller.abort();
  await expect(
    fetchWithDeadline("https://fixture.test", { signal: caller.signal }),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(fetch).not.toHaveBeenCalled();
});
