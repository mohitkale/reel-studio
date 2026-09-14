import { afterEach, describe, expect, it, vi } from "vitest";

import { createStockMediaProviderRegistry } from "./registry";
import {
  COVERR_API_INTRODUCTION_URL,
  COVERR_API_START_URL,
  COVERR_DEVELOPER_URL,
  COVERR_LICENSE_GATE,
  COVERR_LICENSE_URL,
  createCoverrProvider,
} from "./coverr";
import { STOCK_PROVIDER_IDS, StockError } from "./types";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.COVERR_API_KEY;
});

describe("Coverr license gate", () => {
  it("records the current conflicting official sources", () => {
    expect(COVERR_LICENSE_GATE).toEqual({
      status: "blocked",
      reviewedAt: "2026-09-15",
      sources: [
        COVERR_API_INTRODUCTION_URL,
        COVERR_API_START_URL,
        COVERR_DEVELOPER_URL,
        COVERR_LICENSE_URL,
      ],
      reason: expect.stringContaining("conflict"),
    });
  });

  it("is discoverable only as disabled and never appears in key settings", async () => {
    const registry = createStockMediaProviderRegistry();
    expect(registry.listCapabilities()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "coverr",
          label: "Coverr (disabled)",
          capabilities: expect.objectContaining({
            kinds: ["video"],
            acquisitionPolicies: ["download"],
          }),
        }),
      ]),
    );
    await expect(registry.health("coverr")).resolves.toMatchObject({
      status: "disabled",
      message: expect.stringContaining("license pages conflict"),
    });
    expect(STOCK_PROVIDER_IDS).not.toContain("coverr");
  });

  it("rejects search before reading a key or making any network request", async () => {
    process.env.COVERR_API_KEY = "must_not_be_read_or_sent";
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      createCoverrProvider().search({
        query: "city",
        kind: "video",
        perPage: 20,
      }),
    ).rejects.toMatchObject<Partial<StockError>>({
      status: 451,
      providerId: "coverr",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
