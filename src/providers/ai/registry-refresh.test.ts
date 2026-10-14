import { afterEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ version: "old", create: vi.fn() }));
vi.mock("./gemini", () => ({
  GEMINI_DEFAULT_MODEL: "fixture",
  createGeminiProvider: () => {
    state.create();
    const version = state.version;
    return {
      generatePlan: async () => ({
        projectName: version,
        scriptName: version,
        scenes: [],
      }),
    };
  },
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  state.create.mockClear();
  state.version = "old";
});

it("refreshes development provider closures after source updates without making discovery calls", async () => {
  vi.stubEnv("NODE_ENV", "development");
  const { getAIProvider } = await import("./registry");
  const input = { mode: "idea" as const, brief: "fixture" };
  expect((await getAIProvider("gemini").generatePlan(input)).projectName).toBe(
    "old",
  );
  state.version = "updated";
  expect((await getAIProvider("gemini").generatePlan(input)).projectName).toBe(
    "updated",
  );
  expect(state.create).toHaveBeenCalledTimes(2);
});

it("retains the production provider cache", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const { getAIProvider } = await import("./registry");
  getAIProvider("gemini");
  getAIProvider("gemini");
  expect(state.create).toHaveBeenCalledTimes(1);
});
