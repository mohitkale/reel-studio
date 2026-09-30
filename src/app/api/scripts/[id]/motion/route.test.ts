// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";

const { authorize, replan, getScript } = vi.hoisted(() => ({
  authorize: vi.fn(),
  replan: vi.fn(),
  getScript: vi.fn(),
}));
vi.mock("@/server/auth", () => ({ authorize }));
vi.mock("@/library/motion-direction-service", () => ({
  replanMotionDirection: replan,
}));
vi.mock("@/library/repositories/scripts", () => ({ getScript }));

import { POST } from "./route";
import { ProviderError } from "@/providers/voice/types";
const context = { params: Promise.resolve({ id: "script" }) };
const request = (body: string) =>
  new Request("http://localhost/api/scripts/script/motion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

beforeEach(() => {
  vi.resetAllMocks();
});

it("rejects unauthorized writes before reading or planning scenes", async () => {
  authorize.mockImplementation(() => {
    throw new ProviderError("No write access", 403);
  });
  expect((await POST(request("{}"), context)).status).toBe(403);
  expect(replan).not.toHaveBeenCalled();
});

it("rejects malformed JSON and unsupported input, including content edits", async () => {
  for (const body of [
    "{",
    '{"ambition":"random"}',
    '{"ambition":"clean","spokenText":"Changed copy"}',
  ]) {
    expect((await POST(request(body), context)).status).toBe(400);
  }
  expect(replan).not.toHaveBeenCalled();
});

it("returns actionable statuses for missing and legacy scripts", async () => {
  replan
    .mockResolvedValueOnce({ state: "not_found" })
    .mockResolvedValueOnce({ state: "legacy" });
  expect((await POST(request("{}"), context)).status).toBe(404);
  expect((await POST(request("{}"), context)).status).toBe(409);
  expect(getScript).not.toHaveBeenCalled();
});

it("returns the newly saved script and change report", async () => {
  replan.mockResolvedValue({
    state: "planned",
    changedSceneIds: ["scene"],
    protectedSceneCount: 2,
  });
  getScript.mockResolvedValue({
    id: "script",
    motionPlan: { ambition: "clean" },
  });
  const response = await POST(request('{"ambition":"clean"}'), context);
  expect(response.status).toBe(200);
  expect(replan).toHaveBeenCalledWith("script", {
    ambition: "clean",
    newVariation: false,
  });
  expect(await response.json()).toMatchObject({
    result: { changedSceneIds: ["scene"] },
    script: { motionPlan: { ambition: "clean" } },
  });
});

it("forwards the chapter motif setting and rejects unbounded choreography input", async () => {
  replan.mockResolvedValue({ state: "planned", changedSceneIds: [] });
  expect((await POST(request('{"chapterMotifs":true}'), context)).status).toBe(
    200,
  );
  expect(replan).toHaveBeenLastCalledWith("script", {
    chapterMotifs: true,
    newVariation: false,
  });
  expect(
    (await POST(request('{"chapterMotifs":"random"}'), context)).status,
  ).toBe(400);
});
