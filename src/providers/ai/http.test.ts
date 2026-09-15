import { afterEach, describe, expect, it, vi } from "vitest";

import { aiFetch } from "@/providers/ai/http";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AI provider request retries", () => {
  it("never retries an uncertain paid POST", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("busy", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      aiFetch(
        "https://provider.invalid/generate",
        { method: "POST", body: "{}" },
        "openai",
      ),
    ).rejects.toThrow("busy right now");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports an aborted request as cancellation without retrying", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new DOMException("aborted", "AbortError"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      aiFetch(
        "https://provider.invalid/models",
        { method: "GET", signal: controller.signal },
        "openai",
      ),
    ).rejects.toMatchObject({ status: 499 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
