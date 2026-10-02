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

describe("request and provider validation boundaries", () => {
  it("maps invalid client fields to 400 and preserves issue details", async () => {
    const { z } = await import("zod");
    const { parseClientInput } = await import("./api-helpers");
    let error: unknown;
    try {
      parseClientInput(z.object({ name: z.string().min(1) }), { name: "" });
    } catch (caught) {
      error = caught;
    }
    const response = errorResponse(error);
    expect(response.status).toBe(400);
    expect((await response.json()).issues[0].path).toEqual(["name"]);
  });
  it("keeps invalid provider output as 502", async () => {
    const { z } = await import("zod");
    const result = z
      .object({ models: z.array(z.string()) })
      .safeParse({ models: false });
    if (result.success) throw new Error("Expected invalid provider payload");
    const response = errorResponse(result.error);
    expect(response.status).toBe(502);
    expect((await response.json()).error).toBe(
      "Unexpected response shape from provider",
    );
  });
  it("rejects malformed JSON but permits an explicitly optional empty body", async () => {
    const { readRequestJson } = await import("./api-helpers");
    for (const body of ["{", "", " "]) {
      try {
        await readRequestJson(
          new Request("http://localhost", { method: "POST", body }),
        );
      } catch (error) {
        expect(errorResponse(error).status).toBe(400);
        continue;
      }
      throw new Error("Malformed body was accepted");
    }
    await expect(
      readRequestJson(new Request("http://localhost", { method: "POST" }), {
        allowEmpty: true,
      }),
    ).resolves.toEqual({});
    await expect(
      readRequestJson(
        new Request("http://localhost", { method: "POST", body: "{" }),
        { allowEmpty: true },
      ),
    ).rejects.toThrow();
  });
});
