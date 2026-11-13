// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeProviderRequest: vi.fn(),
  getAIProvider: vi.fn(),
}));
vi.mock("@/server/auth", () => ({
  authorizeProviderRequest: mocks.authorizeProviderRequest,
}));
vi.mock("@/providers/ai/registry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/providers/ai/registry")>()),
  getAIProvider: mocks.getAIProvider,
}));

vi.mock("@/research/storyboard-research", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/research/storyboard-research")>();
  // Never touch the real .data cache from a test.
  return {
    ...actual,
    fileResearchCache: () => {
      const store = new Map<string, never>();
      return {
        get: async (key: string) => store.get(key) ?? null,
        set: async (key: string, value: never) => void store.set(key, value),
      };
    },
  };
});

import { POST } from "./route";

const reply = JSON.stringify({
  version: 1,
  title: "T",
  scenes: [
    { type: "hook", headline: "H", narration: "A hook worth hearing today." },
  ],
});
const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/storyboards/write", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
const provider = (text = reply) => ({
  id: "gemini",
  label: "Gemini",
  isConfigured: () => true,
  completeStructured: vi.fn(async () => text),
});

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.resetAllMocks();
  mocks.authorizeProviderRequest.mockResolvedValue({
    origin: "web",
    token: null,
  });
});

it("writes, lints and returns a storyboard without producing anything", async () => {
  const p = provider();
  mocks.getAIProvider.mockReturnValue(p);
  const response = await post({
    providerId: "gemini",
    brief: { topic: "Sleep" },
    research: "off",
  });
  const json = await response.json();
  expect(response.status).toBe(200);
  expect(json).toMatchObject({ ok: true, attempts: 1, providerId: "gemini" });
  expect(json.storyboard.title).toBe("T");
  expect(mocks.authorizeProviderRequest).toHaveBeenCalledTimes(1);
  expect(json.research.note).toContain("research is off");
});

it("reports unrepairable replies with errors and honours retry: false", async () => {
  const p = provider("{}");
  mocks.getAIProvider.mockReturnValue(p);
  const json = await (
    await post({
      providerId: "gemini",
      brief: { topic: "Sleep" },
      retry: false,
      research: "off",
    })
  ).json();
  expect(json.ok).toBe(false);
  expect(json.attempts).toBe(1);
  expect(p.completeStructured).toHaveBeenCalledTimes(1);
  expect(json.errors[0]).toHaveProperty("example");
});

it("rejects an unconfigured provider, unknown fields and a missing topic", async () => {
  mocks.getAIProvider.mockReturnValue({
    ...provider(),
    isConfigured: () => false,
  });
  expect(
    (await post({ providerId: "gemini", brief: { topic: "x" } })).status,
  ).toBe(400);
  expect(
    (await post({ providerId: "gemini", brief: { topic: "x" }, extra: 1 }))
      .status,
  ).toBe(400);
  expect((await post({ providerId: "gemini", brief: {} })).status).toBe(400);
});

it("authorizes the research call as a second paid request and reports the outcome", async () => {
  const p = provider();
  mocks.getAIProvider.mockReturnValue(p);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("down", { status: 503 })),
  );
  const json = await (
    await post({ providerId: "gemini", brief: { topic: "Sleep" } })
  ).json();
  expect(mocks.authorizeProviderRequest).toHaveBeenCalledTimes(2);
  expect(json.research.status).toBe("failed");
  expect(json.ok).toBe(true);
  // Research is skipped, with no second authorization, for your own source text.
  mocks.authorizeProviderRequest.mockClear();
  await post({
    providerId: "gemini",
    brief: { topic: "Sleep" },
    fromSourceText: true,
  });
  expect(mocks.authorizeProviderRequest).toHaveBeenCalledTimes(1);
});
