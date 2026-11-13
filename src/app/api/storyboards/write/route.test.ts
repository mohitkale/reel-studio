// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";

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
  });
  const json = await response.json();
  expect(response.status).toBe(200);
  expect(json).toMatchObject({ ok: true, attempts: 1, providerId: "gemini" });
  expect(json.storyboard.title).toBe("T");
  expect(mocks.authorizeProviderRequest).toHaveBeenCalledWith(
    expect.anything(),
    ["gemini"],
  );
});

it("reports unrepairable replies with errors and honours retry: false", async () => {
  const p = provider("{}");
  mocks.getAIProvider.mockReturnValue(p);
  const json = await (
    await post({
      providerId: "gemini",
      brief: { topic: "Sleep" },
      retry: false,
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
