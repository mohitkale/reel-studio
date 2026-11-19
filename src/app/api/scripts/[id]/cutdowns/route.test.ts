import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  produce: vi.fn(),
  write: vi.fn(),
  provider: { id: "ollama", label: "Ollama", isConfigured: () => true },
}));

vi.mock("@/server/auth", () => ({
  authorizeRequest: () => ({ origin: "web", token: null }),
  authorizeProviderRequest: async () => ({}),
}));
vi.mock("@/library/production-job-executor", () => ({
  executeProductionJob: vi.fn(),
}));
vi.mock("@/library/production-worker", () => ({
  runProductionWorkerOnce: vi.fn(),
}));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: () => {},
}));
vi.mock("@/library/project-storyboard", () => ({
  projectToStoryboard: async () => ({
    storyboard: {
      version: 1,
      kind: "video",
      title: "Sleep",
      scenes: Array.from({ length: 6 }, (_, i) => ({
        type: i === 0 ? "hook" : "statement",
        headline: `Scene ${i}`,
        narration: `This is the spoken line for scene number ${i} in the long video today.`,
      })),
    },
  }),
}));
vi.mock("@/library/storyboard-production", () => ({
  produceFromStoryboard: mocks.produce,
}));
vi.mock("@/providers/ai/registry", () => ({
  getAIProvider: () => mocks.provider,
}));
vi.mock("@/providers/ai/storyboard-writer", () => ({
  writeStoryboard: mocks.write,
}));

import { POST } from "./route";

const context = { params: Promise.resolve({ id: "s1" }) };
const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/scripts/s1/cutdowns", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    context,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.produce.mockResolvedValue({ dryRun: false, jobId: "j" });
});

it("changes only the opening scene when a writer sharpens the hook", async () => {
  mocks.write.mockResolvedValue({
    storyboard: {
      kind: "video",
      scenes: [
        {
          type: "hook",
          headline: "Why sleep?",
          narration: "Why does sleep matter so much?",
        },
        {
          type: "statement",
          headline: "CHANGED",
          narration: "Changed text should be ignored.",
        },
      ],
    },
  });
  const response = await post({ count: 1, writer: { providerId: "ollama" } });
  const json = await response.json();
  expect(json.shorts[0].hookRewritten).toBe(true);
  const sent = mocks.produce.mock.calls[0]![0].scenes;
  expect(
    sent.find((s: { headline: string }) => s.headline === "Why sleep?"),
  ).toBeTruthy();
  expect(sent.some((s: { headline: string }) => s.headline === "CHANGED")).toBe(
    false,
  );
});

it("keeps the plain-code hook when the writer fails", async () => {
  mocks.write.mockRejectedValue(new Error("model offline"));
  const response = await post({ count: 1, writer: { providerId: "ollama" } });
  const json = await response.json();
  expect(response.status).toBe(202);
  expect(json.shorts[0].hookRewritten).toBe(false);
  expect(mocks.produce).toHaveBeenCalled();
});

it("makes shorts with no writer call at all by default", async () => {
  await post({ count: 1 });
  expect(mocks.write).not.toHaveBeenCalled();
});
