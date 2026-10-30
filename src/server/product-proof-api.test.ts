// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ read: vi.fn(), control: vi.fn() }));
vi.mock("@/library/product-proof-service", () => ({
  readProductProof: m.read,
  controlProductProof: m.control,
}));
import { GET, POST } from "@/app/api/scripts/[id]/product-proof/route";
const context = { params: Promise.resolve({ id: "film" }) };
const request = (body?: unknown, authorized = false) =>
  new Request("http://localhost:3000/api/scripts/film/product-proof", {
    method: body === undefined ? "GET" : "POST",
    headers: {
      host: "localhost:3000",
      ...(authorized ? { authorization: "Bearer fixture-proof-token" } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("REEL_STRICT_AUTH", "1");
  vi.stubEnv("MCP_API_TOKEN", "fixture-proof-token");
  vi.stubEnv("MCP_NAMED_TOKENS", "[]");
});
afterEach(() => vi.unstubAllEnvs());
it("authorizes proof reads and writes before accessing storage", async () => {
  expect((await GET(request(), context)).status).toBe(401);
  expect((await POST(request({}), context)).status).toBe(401);
  expect(m.read).not.toHaveBeenCalled();
  expect(m.control).not.toHaveBeenCalled();
});
it("rejects copy rewrites and paid budgets in visual-only requests", async () => {
  const input = {
    action: "apply",
    expectedHash: "a".repeat(64),
    featureId: "feature",
  };
  for (const extra of [
    { text: "Invented outcome" },
    { budget: { maxProviderCalls: 1 } },
  ])
    expect(
      (await POST(request({ ...input, ...extra }, true), context)).status,
    ).toBe(400);
  expect(m.control).not.toHaveBeenCalled();
  m.control.mockResolvedValue({ state: "applied" });
  expect((await POST(request(input, true), context)).status).toBe(200);
  expect(m.control).toHaveBeenCalledWith("film", input);
});
