// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const { authorize, analyze, edit, getScript } = vi.hoisted(() => ({
  authorize: vi.fn(),
  analyze: vi.fn(),
  edit: vi.fn(),
  getScript: vi.fn(),
}));
vi.mock("@/server/auth", () => ({ authorize }));
vi.mock("@/library/music-map-service", () => ({
  analyzeMusicMap: analyze,
  editMusicMap: edit,
}));
vi.mock("@/library/repositories/scripts", () => ({ getScript }));
import { POST, PATCH } from "./route";
import { ProviderError } from "@/providers/voice/types";
const context = { params: Promise.resolve({ id: "script" }) };
const request = (body = "{}") =>
  new Request("http://localhost/api/scripts/script/music-map", {
    method: "POST",
    body,
  });
const expected = {
  version: 1,
  sourceUrl: "/music/test.wav",
  sourceHash: "a".repeat(64),
  durationSeconds: 8,
  bpm: 120,
  offsetSeconds: 0,
  confidence: 0.8,
  method: "energy-onsets",
  disabledBeats: [],
  dropSeconds: null,
};
beforeEach(() => {
  vi.resetAllMocks();
  authorize.mockReturnValue("web");
});
it("rejects unauthorized edits and keeps analysis in the editor", async () => {
  authorize.mockImplementationOnce(() => {
    throw new ProviderError("Unauthorized", 401);
  });
  expect((await PATCH(request(), context)).status).toBe(401);
  authorize.mockReturnValue("mcp");
  expect((await POST(request(), context)).status).toBe(403);
  expect(analyze).not.toHaveBeenCalled();
  expect(edit).not.toHaveBeenCalled();
});
it("returns saved maps and scripts and supports MCP timing edits", async () => {
  analyze.mockResolvedValue(expected);
  getScript.mockResolvedValue({ musicMap: expected });
  expect((await POST(request(), context)).status).toBe(200);
  expect(analyze).toHaveBeenCalledWith("script", "http://localhost");
  authorize.mockReturnValue("mcp");
  edit.mockResolvedValue(expected);
  expect(
    (
      await PATCH(
        request(JSON.stringify({ expected, changes: { dropSeconds: 2 } })),
        context,
      )
    ).status,
  ).toBe(200);
  expect(edit).toHaveBeenCalledWith(
    "script",
    { expected, changes: { dropSeconds: 2 } },
    "http://localhost",
  );
});
it("rejects malformed edits and reports stale maps", async () => {
  for (const body of [
    "{",
    "{}",
    JSON.stringify({ expected, changes: { bpm: -1 } }),
    JSON.stringify({ expected, changes: { sceneTiming: 4 } }),
  ])
    expect((await PATCH(request(body), context)).status).toBe(400);
  expect(edit).not.toHaveBeenCalled();
  edit.mockRejectedValue(new ProviderError("Music direction changed", 409));
  expect(
    (await PATCH(request(JSON.stringify({ expected, changes: {} })), context))
      .status,
  ).toBe(409);
});
