// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  quota: vi.fn(),
  generate: vi.fn(),
}));
vi.mock("@/server/auth", () => ({
  authorize: mocks.auth,
  authorizeProviderRequest: mocks.quota,
}));
vi.mock("@/library/chapter-generation-service", () => ({
  generateDraftChapter: mocks.generate,
}));
import { POST } from "./route";
import { AIError } from "@/providers/ai/types";
const expected = {
  version: "1.0.0",
  topic: "Supplied facts",
  chapters: [
    { id: "proof", title: "Proof", brief: "Supplied proof", sceneCount: 2 },
  ],
};
const input = {
  expected,
  chapterId: "proof",
  providerId: "openai",
  maxProviderCalls: 1,
};
const request = (body: unknown) =>
  new Request("http://localhost/api/scripts/script/chapter-draft/generate", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const context = { params: Promise.resolve({ id: "script" }) };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.generate.mockImplementation(async (_id, _input, authorize) => {
    await authorize();
    return { chapterDraft: expected };
  });
});
it("shares web/MCP authorization, bounded usage and the selected chapter contract", async () => {
  for (const origin of ["web", "mcp"]) {
    mocks.auth.mockReturnValue(origin);
    const response = await POST(request(input), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ draft: expected });
    expect(mocks.generate).toHaveBeenLastCalledWith(
      "script",
      { ...input, mediaPreference: "none" },
      expect.any(Function),
      expect.any(AbortSignal),
    );
    expect(mocks.quota).toHaveBeenLastCalledWith(expect.any(Request), [
      "openai",
    ]);
  }
});
it("rejects invalid budgets and bulk execution, preserves quotas, cancellation and conflicts", async () => {
  for (const body of [
    "{",
    {},
    { ...input, maxProviderCalls: 2 },
    { ...input, maxProviderCalls: undefined },
    { ...input, chapterIds: ["proof"] },
    { ...input, expected: null },
  ])
    expect((await POST(request(body), context)).status).toBe(400);
  expect(mocks.generate).not.toHaveBeenCalled();
  expect(mocks.quota).not.toHaveBeenCalled();
  mocks.auth.mockImplementationOnce(() => {
    throw new AIError("Unauthorized", 401);
  });
  expect((await POST(request(input), context)).status).toBe(401);
  mocks.quota.mockRejectedValueOnce(new AIError("Quota", 403));
  expect((await POST(request(input), context)).status).toBe(403);
  for (const status of [400, 409, 499, 502]) {
    mocks.generate.mockRejectedValueOnce(new AIError("Failed", status));
    expect((await POST(request(input), context)).status).toBe(status);
  }
});
