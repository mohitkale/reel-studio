// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  propose: vi.fn(),
  save: vi.fn(),
  script: vi.fn(),
}));
vi.mock("@/server/auth", () => ({ authorize: mocks.authorize }));
vi.mock("@/library/chapter-service", () => ({
  proposeScriptChapters: mocks.propose,
  saveChapterPlan: mocks.save,
}));
vi.mock("@/library/repositories/scripts", () => ({ getScript: mocks.script }));
import { POST, PATCH } from "./route";
import { ProviderError } from "@/providers/voice/types";
const context = { params: Promise.resolve({ id: "script" }) };
const request = (body = "{}") =>
  new Request("http://localhost/api/scripts/script/chapters", {
    method: "POST",
    body,
  });
const plan = {
  version: "1.0.0",
  chapters: [{ id: "intro", title: "Start here", firstSceneId: "scene" }],
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.authorize.mockReturnValue("web");
});
it("protects writes and supports the same proposal/edit contract for web and MCP", async () => {
  mocks.authorize.mockImplementationOnce(() => {
    throw new ProviderError("Unauthorized", 401);
  });
  expect((await PATCH(request(), context)).status).toBe(401);
  expect(mocks.save).not.toHaveBeenCalled();
  for (const origin of ["web", "mcp"]) {
    mocks.authorize.mockReturnValue(origin);
    mocks.propose.mockResolvedValue({ proposal: plan });
    expect(
      (await POST(request(JSON.stringify({ takeId: "take" })), context)).status,
    ).toBe(200);
    expect(mocks.propose).toHaveBeenLastCalledWith("script", "take");
    mocks.save.mockResolvedValue(plan);
    mocks.script.mockResolvedValue({ chapterPlan: plan });
    expect(
      (
        await PATCH(
          request(
            JSON.stringify({
              expected: null,
              expectedSceneIds: ["scene"],
              plan,
            }),
          ),
          context,
        )
      ).status,
    ).toBe(200);
  }
});
it("rejects unknown/malformed changes and reports stale outlines", async () => {
  for (const body of [
    "{",
    "{}",
    JSON.stringify({
      expected: null,
      expectedSceneIds: ["scene"],
      plan,
      durationLimit: 600,
    }),
  ])
    expect((await PATCH(request(body), context)).status).toBe(400);
  expect(
    (await POST(request(JSON.stringify({ rewrite: true })), context)).status,
  ).toBe(400);
  expect(mocks.save).not.toHaveBeenCalled();
  mocks.save.mockRejectedValue(new ProviderError("Scenes changed", 409));
  expect(
    (
      await PATCH(
        request(
          JSON.stringify({ expected: null, expectedSceneIds: ["scene"], plan }),
        ),
        context,
      )
    ).status,
  ).toBe(409);
});
