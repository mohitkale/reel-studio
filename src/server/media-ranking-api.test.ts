// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  start: vi.fn(),
  run: vi.fn(),
  context: vi.fn(),
  read: vi.fn(),
  control: vi.fn(),
}));
vi.mock("@/library/media-ranking-service", () => ({
  startMediaRanking: m.start,
  runMediaRanking: m.run,
  readMediaRankingContext: m.context,
  readMediaRanking: m.read,
}));
vi.mock("@/library/repositories/media-ranking-jobs", () => ({
  controlMediaRankingJob: m.control,
}));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: vi.fn(),
}));
import {
  POST as start,
  GET as context,
} from "@/app/api/scripts/[id]/media-ranking/route";
import {
  POST as control,
  GET as status,
} from "@/app/api/scripts/[id]/media-ranking/[jobId]/route";
const ctx = { params: Promise.resolve({ id: "script", jobId: "job" }) };
const req = (method = "POST", body: unknown = {}, auth = false) =>
  new Request("http://localhost:3000/api/scripts/script/media-ranking", {
    method,
    headers: {
      host: "localhost:3000",
      ...(auth ? { authorization: "Bearer fixture-media-token" } : {}),
    },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("REEL_STRICT_AUTH", "1");
  vi.stubEnv("MCP_API_TOKEN", "fixture-media-token");
  vi.stubEnv("MCP_NAMED_TOKENS", "[]");
});
afterEach(() => vi.unstubAllEnvs());
it("authorizes every scoring/status/control endpoint before storage or provider work", async () => {
  expect((await start(req(), ctx)).status).toBe(401);
  expect((await context(req("GET"), ctx)).status).toBe(401);
  expect((await control(req(), ctx)).status).toBe(401);
  expect((await status(req("GET"), ctx)).status).toBe(401);
  for (const mock of Object.values(m)) expect(mock).not.toHaveBeenCalled();
});
it("requires a separate one-call/six-image budget and an explicit model", async () => {
  const input = {
    idempotencyKey: "media-key-1",
    expectedHash: "a".repeat(64),
    sceneId: "scene",
    stockProviderId: "pexels",
    search: { query: "ocean", kind: "image" },
    candidateIds: ["one"],
    modelId: "explicit-model",
    budget: { maxProviderCalls: 0, maxImages: 6, deadlineMs: 30000 },
  };
  expect((await start(req("POST", input, true), ctx)).status).toBe(400);
  expect(
    (
      await start(
        req(
          "POST",
          {
            ...input,
            modelId: "",
            budget: { ...input.budget, maxProviderCalls: 1 },
          },
          true,
        ),
        ctx,
      )
    ).status,
  ).toBe(400);
  expect(m.start).not.toHaveBeenCalled();
});
