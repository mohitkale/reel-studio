// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  providerAuth: vi.fn(),
  generate: vi.fn(),
  save: vi.fn(),
  script: vi.fn(),
}));
vi.mock("@/server/auth", () => ({
  authorize: mocks.auth,
  authorizeProviderRequest: mocks.providerAuth,
}));
vi.mock("@/library/chapter-draft-service", () => ({
  generateChapterDraft: mocks.generate,
  saveChapterDraft: mocks.save,
}));
vi.mock("@/library/repositories/scripts", () => ({ getScript: mocks.script }));
import { POST, PATCH } from "./route";
import { AIError } from "@/providers/ai/types";
const context = { params: Promise.resolve({ id: "script" }) };
const request = (body: unknown) =>
  new Request("http://localhost/api/scripts/script/chapter-draft", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const input = {
  providerId: "openai",
  topic: "Supplied workflow",
  chapterCount: 2,
  scenesPerChapter: 4,
};
const draft = {
  version: "1.0.0",
  topic: input.topic,
  chapters: [
    {
      id: "next",
      title: "Next",
      brief: "A supplied writing brief",
      sceneCount: 4,
    },
  ],
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.generate.mockImplementation(async (_id, _input, authorize) => {
    await authorize();
    return draft;
  });
  mocks.save.mockResolvedValue(draft);
  mocks.script.mockResolvedValue({ chapterDraft: draft });
});
it("uses the same generation and edit contract for web and MCP and preserves provider authorization", async () => {
  for (const origin of ["web", "mcp"]) {
    mocks.auth.mockReturnValue(origin);
    expect((await POST(request(input), context)).status).toBe(200);
    expect(mocks.providerAuth).toHaveBeenLastCalledWith(expect.any(Request), [
      "openai",
    ]);
    expect(
      (await PATCH(request({ expected: draft, draft }), context)).status,
    ).toBe(200);
    expect(mocks.save).toHaveBeenLastCalledWith("script", {
      expected: draft,
      draft,
    });
  }
});
it("rejects malformed/unauthorized requests and reports quota, cancellation and conflict failures", async () => {
  for (const body of [
    "{",
    {},
    { ...input, chapterCount: 13 },
    { ...input, scenesPerChapter: 21 },
    { ...input, executeAll: true },
  ])
    expect((await POST(request(body), context)).status).toBe(400);
  expect(mocks.generate).not.toHaveBeenCalled();
  expect(mocks.providerAuth).not.toHaveBeenCalled();
  mocks.auth.mockImplementationOnce(() => {
    throw new AIError("Unauthorized", 401);
  });
  expect((await POST(request(input), context)).status).toBe(401);
  mocks.providerAuth.mockRejectedValueOnce(new AIError("Quota reached", 403));
  expect((await POST(request(input), context)).status).toBe(403);
  for (const status of [409, 499]) {
    mocks.generate.mockRejectedValueOnce(
      new AIError("Changed or canceled", status),
    );
    expect((await POST(request(input), context)).status).toBe(status);
  }
  expect(
    (await PATCH(request({ expected: draft, draft, unknown: true }), context))
      .status,
  ).toBe(400);
  mocks.save.mockRejectedValueOnce(new AIError("Draft changed", 409));
  expect(
    (await PATCH(request({ expected: draft, draft }), context)).status,
  ).toBe(409);
});
