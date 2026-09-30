import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  update: vi.fn(),
  get: vi.fn(),
}));
vi.mock("@/server/auth", () => ({ authorize: mocks.authorize }));
vi.mock("@/library/repositories/scripts", () => ({
  updateScript: mocks.update,
  getScript: mocks.get,
}));
import { PATCH } from "./route";
const context = { params: Promise.resolve({ id: "script" }) };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorize.mockReturnValue("web");
});
it("shares the persisted mastering choice between web and MCP edits", async () => {
  for (const origin of ["web", "mcp"]) {
    mocks.authorize.mockReturnValue(origin);
    const response = await PATCH(
      new Request("http://localhost/api/scripts/script", {
        method: "PATCH",
        body: JSON.stringify({ audioMastering: "balanced" }),
      }),
      context,
    );
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenLastCalledWith("script", {
      audioMastering: "balanced",
    });
  }
});
it("rejects unsupported mastering modes without a write", async () => {
  const response = await PATCH(
    new Request("http://localhost/api/scripts/script", {
      method: "PATCH",
      body: JSON.stringify({ audioMastering: "unchecked-loud" }),
    }),
    context,
  );
  expect(response.status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
});
