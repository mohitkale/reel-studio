// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { AIError } from "@/providers/ai/types";
const mocks = vi.hoisted(() => ({
  authorizeRead: vi.fn(),
  requireWeb: vi.fn(),
  list: vi.fn(),
  readProvider: vi.fn(),
  recordGenerationProbe: vi.fn(),
  getAIProvider: vi.fn(),
  listAIProviderStatuses: vi.fn(),
  probeCreationProvider: vi.fn(),
}));
vi.mock("@/server/auth", () => ({
  authorizeRead: mocks.authorizeRead,
  requireWeb: mocks.requireWeb,
}));
vi.mock("@/server/local-ai-config", () => ({ localAIConfigStore: mocks }));
vi.mock("@/providers/ai/registry", () => mocks);
vi.mock("@/providers/ai/readiness", () => mocks);
import { GET, POST } from "./route";
const req = (body: unknown) =>
  new Request("http://localhost/api/creation-readiness", {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
});
it("reads saved status without inference and excludes cloud credentials", async () => {
  mocks.list.mockResolvedValue([]);
  mocks.listAIProviderStatuses.mockResolvedValue([
    { kind: "cloud", id: "openai", configured: false },
  ]);
  expect(
    (await GET(new Request("http://localhost/api/creation-readiness"))).status,
  ).toBe(200);
  expect(mocks.getAIProvider).not.toHaveBeenCalled();
  expect(mocks.probeCreationProvider).not.toHaveBeenCalled();
});
it("requires web authorization before local inference and rejects cloud probes", async () => {
  mocks.requireWeb.mockImplementationOnce(() => {
    throw new AIError("Web only", 403);
  });
  expect((await POST(req({ providerId: "ollama" }))).status).toBe(403);
  expect((await POST(req({ providerId: "openai" }))).status).toBe(400);
  expect(mocks.readProvider).not.toHaveBeenCalled();
});
it("requires an installed selected model and forwards a bounded cancellation signal", async () => {
  mocks.readProvider.mockResolvedValueOnce({ modelId: "" });
  expect((await POST(req({ providerId: "ollama" }))).status).toBe(400);
  mocks.readProvider.mockResolvedValue({
    modelId: "fixture",
    baseUrl: "http://localhost:11434",
  });
  mocks.probeCreationProvider.mockResolvedValue({ structuredOutput: true });
  expect(
    (await POST(req({ providerId: "ollama", language: "Hindi" }))).status,
  ).toBe(200);
  expect(mocks.probeCreationProvider.mock.lastCall?.slice(1)).toEqual([
    "fixture",
    "Hindi",
    expect.any(AbortSignal),
  ]);
  expect(mocks.recordGenerationProbe).toHaveBeenCalledTimes(2);
});
