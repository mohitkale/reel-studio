import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  produce: vi.fn(),
  submit: vi.fn(),
  reuseNarration: vi.fn(),
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
  drainProductionQueue: vi.fn(),
}));
// The batch service is faked: this test must never write to a real database.
vi.mock("@/library/production-batch-service", () => ({
  submitProductionBatch: mocks.submit,
}));
vi.mock("@/library/production-batch-view", () => ({
  productionBatchView: (batch: { id: string; rows: number }) => ({
    id: batch.id,
    state: "queued",
    items: Array.from({ length: batch.rows }, (_, i) => ({
      rowIndex: i,
      state: "queued",
      job: { id: `job-${i}` },
    })),
  }),
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
vi.mock("@/library/repositories/scripts", () => ({
  getScript: async (id: string) => ({ id, scenes: [] }),
}));
vi.mock("@/library/cutdown-narration", () => ({
  reuseCutdownNarration: mocks.reuseNarration,
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
  mocks.produce.mockImplementation(async () => ({
    dryRun: false,
    scriptId: `script-${Math.random()}`,
    projectId: "p",
  }));
  mocks.submit.mockImplementation(
    async ({ request }: { request: { rows: unknown[] } }) => ({
      id: "batch-1",
      rows: request.rows.length,
    }),
  );
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

it("makes the shorts as one batch with one id", async () => {
  const response = await post({ count: 2 });
  const json = await response.json();
  expect(response.status).toBe(202);
  expect(json.batchId).toBe("batch-1");
  expect(mocks.submit).toHaveBeenCalledTimes(1);
  const rows = mocks.submit.mock.calls[0]![0].request.rows;
  expect(rows).toHaveLength(json.shorts.length);
  expect(rows[0]).toMatchObject({
    kind: "video",
    orientations: ["portrait"],
    captions: "auto",
  });
  expect(rows[0].quickProduce.voice).toMatchObject({
    enabled: true,
    providerId: "kokoro-server",
  });
  expect(mocks.reuseNarration).toHaveBeenCalledTimes(json.shorts.length);
  expect(mocks.reuseNarration.mock.calls[0]![0].voice).toEqual(
    rows[0].quickProduce.voice,
  );
  expect(mocks.reuseNarration.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.submit.mock.invocationCallOrder[0]!,
  );
  // Each project is made without a job of its own; the batch owns the jobs.
  expect(mocks.produce.mock.calls.every((c) => c[1].createOnly === true)).toBe(
    true,
  );
  expect(json.shorts.map((s: { jobId: string }) => s.jobId)).toEqual(
    json.shorts.map((_: unknown, i: number) => `job-${i}`),
  );
});

it("lists the shorts without making anything in preview", async () => {
  const response = await post({ count: 2, preview: true });
  expect(response.status).toBe(200);
  expect(mocks.submit).not.toHaveBeenCalled();
  expect(mocks.produce).not.toHaveBeenCalled();
  expect(mocks.reuseNarration).not.toHaveBeenCalled();
});
