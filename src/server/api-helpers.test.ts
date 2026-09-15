import { describe, expect, it } from "vitest";

import { StockError } from "@/providers/stock/types";
import { errorResponse } from "@/server/api-helpers";

describe("errorResponse", () => {
  it("preserves stock-provider status and identity", async () => {
    const response = errorResponse(
      new StockError("Provider is not configured", 503, "pexels"),
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Provider is not configured",
      providerId: "pexels",
    });
  });
});
