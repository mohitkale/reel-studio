import { afterEach, describe, expect, it, vi } from "vitest";

import { secureLocalAIFetch } from "./local-http";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("secure local AI HTTP", () => {
  it("rejects redirects and never follows them", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: "http://example.com/steal" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      secureLocalAIFetch({
        providerId: "ollama",
        baseUrl: "http://127.0.0.1:11434",
        allowLan: false,
        path: "/api/tags",
      }),
    ).rejects.toThrow("returned a redirect");
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("http://127.0.0.1:11434/api/tags"),
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("reports cancellation distinctly from an offline server", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")),
    );
    await expect(
      secureLocalAIFetch({
        providerId: "lm-studio",
        baseUrl: "http://127.0.0.1:1234",
        allowLan: false,
        path: "/v1/models",
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ status: 499 });
  });

  it("enforces a bounded timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        async (_url: URL, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("timed out", "TimeoutError")),
            );
          }),
      ),
    );
    const request = secureLocalAIFetch({
      providerId: "ollama",
      baseUrl: "http://127.0.0.1:11434",
      allowLan: false,
      path: "/api/tags",
      timeoutMs: 25,
    });
    await vi.advanceTimersByTimeAsync(25);
    await expect(request).rejects.toMatchObject({ status: 504 });
    vi.useRealTimers();
  });
});
