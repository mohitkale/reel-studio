// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const { authorize, createVisualReview } = vi.hoisted(() => ({
  authorize: vi.fn(),
  createVisualReview: vi.fn(),
}));
vi.mock("@/server/auth", () => ({ authorize }));
vi.mock("@/library/visual-review", () => ({ createVisualReview }));
import { POST } from "./route";
import { ProviderError } from "@/providers/voice/types";
const context = { params: Promise.resolve({ id: "script" }) };
const request = (body: string) =>
  new Request("http://localhost/api/scripts/script/review", {
    method: "POST",
    body,
  });
beforeEach(() => {
  vi.resetAllMocks();
  authorize.mockReturnValue("web");
});
it("protects capture from unauthorized and MCP requests", async () => {
  authorize.mockImplementationOnce(() => {
    throw new ProviderError("Unauthorized", 401);
  });
  expect((await POST(request("{}"), context)).status).toBe(401);
  authorize.mockReturnValue("mcp");
  expect((await POST(request('{"sceneIds":["a"]}'), context)).status).toBe(403);
  expect(createVisualReview).not.toHaveBeenCalled();
});
it("rejects malformed and unbounded input before starting capture", async () => {
  for (const body of [
    "{",
    "{}",
    '{"sceneIds":["a","b","c"],"samples":4}',
    '{"sceneIds":["a"],"url":"https://example.test"}',
    '{"sceneIds":["a","b"],"mode":"transition"}',
  ])
    expect((await POST(request(body), context)).status).toBe(400);
  expect(createVisualReview).not.toHaveBeenCalled();
});
it("uses only saved script and selected take inputs", async () => {
  createVisualReview.mockResolvedValue({ stills: [] });
  const response = await POST(
    request('{"sceneIds":["a"],"voiceTakeId":"take"}'),
    context,
  );
  expect(response.status).toBe(200);
  expect(createVisualReview).toHaveBeenCalledWith(
    "script",
    { sceneIds: ["a"], samples: 1, voiceTakeId: "take", mode: "scene" },
    "http://localhost",
    expect.any(AbortSignal),
  );
});
