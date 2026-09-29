// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const { authorize, edit, getScript } = vi.hoisted(() => ({
  authorize: vi.fn(),
  edit: vi.fn(),
  getScript: vi.fn(),
}));
vi.mock("@/server/auth", () => ({ authorize }));
vi.mock("@/library/sfx-cue-edit-service", () => ({ editSfxCue: edit }));
vi.mock("@/library/sfx-service", () => ({
  ensureSfxCues: vi.fn(),
  setSfxEnabled: vi.fn(),
}));
vi.mock("@/library/repositories/scripts", () => ({ getScript }));
import { PATCH } from "./route";
import { ProviderError } from "@/providers/voice/types";
const context = { params: Promise.resolve({ id: "script" }) };
const cue = { sceneId: "scene", sfxId: "pop", offsetSeconds: 0, volume: 0.2 };
const input = {
  index: 0,
  expected: cue,
  action: "edit",
  changes: { volume: 0 },
};
const request = (body: string) =>
  new Request("http://localhost/api/scripts/script/sfx", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
  });
beforeEach(() => vi.resetAllMocks());
it("checks write authorization before editing", async () => {
  authorize.mockImplementation(() => {
    throw new ProviderError("No write access", 403);
  });
  expect((await PATCH(request(JSON.stringify(input)), context)).status).toBe(
    403,
  );
  expect(edit).not.toHaveBeenCalled();
});
it("rejects malformed, unsupported and out-of-range edits", async () => {
  for (const body of [
    "{",
    JSON.stringify({ ...input, changes: { volume: 2 } }),
    JSON.stringify({ ...input, changes: { spokenText: "changed" } }),
    JSON.stringify({ ...input, action: "automatic" }),
    JSON.stringify({ ...input, changes: {} }),
  ]) {
    expect((await PATCH(request(body), context)).status).toBe(400);
  }
  expect(edit).not.toHaveBeenCalled();
});
it("returns missing, stale and invalid timing statuses without reading a script", async () => {
  edit
    .mockResolvedValueOnce({ state: "not_found" })
    .mockResolvedValueOnce({ state: "conflict" })
    .mockResolvedValueOnce({ state: "invalid_timing" });
  for (const status of [404, 409, 400])
    expect((await PATCH(request(JSON.stringify(input)), context)).status).toBe(
      status,
    );
  expect(getScript).not.toHaveBeenCalled();
});
it("accepts a muted edit and returns the saved script", async () => {
  edit.mockResolvedValue({ state: "updated" });
  getScript.mockResolvedValue({ id: "script" });
  const response = await PATCH(request(JSON.stringify(input)), context);
  expect(response.status).toBe(200);
  expect(edit).toHaveBeenCalledWith("script", input);
  expect(await response.json()).toEqual({ script: { id: "script" } });
});
