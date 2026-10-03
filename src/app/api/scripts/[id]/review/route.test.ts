// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const { authorize, createVisualReview, repair, getScript, revision } =
  vi.hoisted(() => ({
    authorize: vi.fn(),
    createVisualReview: vi.fn(),
    repair: vi.fn(),
    getScript: vi.fn(),
    revision: vi.fn(),
  }));
vi.mock("@/server/auth", () => ({ authorize }));
vi.mock("@/library/visual-review", () => ({ createVisualReview }));
vi.mock("@/library/director-review", () => ({
  reviewAndRepairDirection: repair,
}));
vi.mock("@/library/repositories/scripts", () => ({ getScript }));
vi.mock("@/library/production-revision", () => ({
  currentVideoRevisionHash: revision,
}));
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
    {
      sceneIds: ["a"],
      samples: 1,
      voiceTakeId: "take",
      mode: "scene",
      repairPasses: 0,
    },
    "http://localhost",
    expect.any(AbortSignal),
  );
});

it("returns the matching repaired script for editor refresh and rejects changes after recapture", async () => {
  repair.mockResolvedValue({
    revision: "repaired",
    repair: { repairedSceneIds: ["a"] },
    stills: [],
  });
  getScript.mockResolvedValue({
    id: "script",
    scenes: [
      {
        id: "a",
        direction: {
          version: 1,
          composition: "layered-title",
          role: "headline",
        },
      },
    ],
  });
  revision
    .mockResolvedValueOnce("repaired")
    .mockResolvedValueOnce("later-edit");
  const body = '{"sceneIds":["a"],"repairPasses":1}';
  const response = await POST(request(body), context);
  expect(response.status).toBe(200);
  expect((await response.json()).script.scenes[0].direction.composition).toBe(
    "layered-title",
  );
  expect((await POST(request(body), context)).status).toBe(409);
});
