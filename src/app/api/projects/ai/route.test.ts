// @vitest-environment node
import { expect, it, vi } from "vitest";
const { authorizeProviderRequest, getAIProvider } = vi.hoisted(() => ({
  authorizeProviderRequest: vi.fn(),
  getAIProvider: vi.fn(),
}));
vi.mock("@/server/auth", () => ({ authorizeProviderRequest }));
vi.mock("@/providers/ai/registry", () => ({
  getAIProvider,
  isAIProviderId: vi.fn(),
}));
vi.mock("@/library/repositories/brandkits", () => ({
  getBrandKit: vi.fn().mockResolvedValue(null),
}));
import { POST } from "./route";
it("rejects a missing explicit brand before spending a planner call", async () => {
  const response = await POST(
    new Request("http://localhost/api/projects/ai", {
      method: "POST",
      body: JSON.stringify({
        providerId: "gemini",
        mode: "idea",
        brief: "A calendar idea",
        brandKitId: "deleted-brand",
      }),
    }),
  );
  expect(response.status).toBe(404);
  expect(getAIProvider).not.toHaveBeenCalled();
});
it("rejects zero paid budget before credentials or planner invocation", async () => {
  for (const providerId of ["openai", "gemini"]) {
    const response = await POST(
      new Request("http://localhost/api/projects/ai", {
        method: "POST",
        body: JSON.stringify({
          providerId,
          mode: "idea",
          brief: "A useful idea",
          directorBudget: { maxPaidCalls: 0 },
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("no paid planner calls");
  }
  expect(authorizeProviderRequest).not.toHaveBeenCalled();
  expect(getAIProvider).not.toHaveBeenCalled();
});
