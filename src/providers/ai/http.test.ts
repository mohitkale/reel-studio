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
});
