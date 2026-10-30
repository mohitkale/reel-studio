// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { evidenceFixture } from "@/research/fixtures";
import { scenePlanSchema } from "@/providers/ai/types";
const m = vi.hoisted(() => ({
  generate: vi.fn(),
  create: vi.fn(),
  evidence: vi.fn(),
  submit: vi.fn(),
  auth: vi.fn(),
}));
vi.mock("@/server/auth", () => ({
  authorizeRead: vi.fn(),
  authorizeRequest: vi.fn(),
  authorizeProviderRequest: m.auth,
}));
vi.mock("@/providers/ai/registry", () => ({
  isAIProviderId: () => true,
  getAIProvider: () => ({ isConfigured: () => true, generatePlan: m.generate }),
  listAIProviderStatuses: async () => [
    { id: "ollama", defaultModel: "fixture-writer" },
  ],
}));
vi.mock("@/library/repositories/research", () => ({
  ResearchRepository: class {
    getEvidence = m.evidence;
  },
}));
vi.mock("@/library/repositories/projects", () => ({
  createProjectFromPlan: m.create,
}));
vi.mock("@/library/repositories/brandkits", () => ({ getBrandKit: vi.fn() }));
vi.mock("@/library/repositories/scripts", () => ({
  getScript: async () => ({ scenes: [] }),
}));
vi.mock("@/library/automatic-stock-media", () => ({
  resolveAutomaticSceneMediaBatch: async (scenes: unknown[]) =>
    scenes.map(() => ({
      state: "skipped",
      message: "No stock",
      background: undefined,
    })),
}));
vi.mock("@/library/soundtrack-service", () => ({
  autoAttachBundledMusic: vi.fn(),
}));
vi.mock("@/library/sfx-service", () => ({ ensureSfxCues: vi.fn() }));
vi.mock("@/library/production-service", () => ({ submitProduction: m.submit }));
vi.mock("@/library/production-worker", () => ({
  runProductionWorkerOnce: vi.fn(),
}));
vi.mock("@/library/production-job-executor", () => ({
  executeProductionJob: vi.fn(),
}));
vi.mock("@/library/repositories/production-jobs", () => ({
  getProductionJobByIdempotencyKey: async () => null,
}));
vi.mock("@/library/production-job-view", () => ({
  productionJobViewWithRevision: async (job: unknown) => job,
}));
import { POST } from "./route";
const pack = evidenceFixture();
pack.sources[0]!.excerpts[0]!.text = "Draft: 42%\nReview: 68%";
const plan = scenePlanSchema.parse({
  projectName: "Research review",
  scriptName: "Evidence",
  scenes: [
    {
      templateId: "hf-statement",
      text: "Compare the supplied results.",
      emphasis: [],
    },
    {
      templateId: "hf-data-chart",
      text: "Draft and review.",
      emphasis: [],
      chart: {
        labels: ["Draft", "Review"],
        series: [{ label: "Supplied values", values: [42, 68], unit: "%" }],
      },
    },
    {
      templateId: "hf-statement",
      text: "Review sources before publishing.",
      emphasis: [],
    },
  ],
});
beforeEach(() => {
  vi.clearAllMocks();
  m.evidence.mockResolvedValue(structuredClone(pack));
  m.generate.mockResolvedValue(structuredClone(plan));
  m.create.mockResolvedValue({ projectId: "project", scriptId: "script" });
  m.auth.mockResolvedValue({ origin: "web", token: null });
  m.submit.mockResolvedValue({ id: "job", state: "succeeded" });
});
const request = (quick = false) =>
  new Request("http://localhost/api/projects/ai", {
    method: "POST",
    body: JSON.stringify({
      providerId: "ollama",
      mode: "idea",
      brief: "Compare the source data in a chart",
      evidenceId: "evidence-1",
      mediaPreference: "none",
      productionPresetId: "data-story",
      ...(quick
        ? {
            quickProduce: {
              enabled: true,
              planner: "ollama",
              voice: { enabled: false },
            },
          }
        : {}),
    }),
  });
it.each([false, true])(
  "creates an evidence-backed draft or Quick Produce (%s) without replaying research",
  async (quick) => {
    const response = await POST(request(quick));
    expect(response.status).toBe(201);
    expect(m.generate).toHaveBeenCalledOnce();
    expect(m.generate.mock.calls[0][0]).toMatchObject({
      evidence: pack,
      modelId: "fixture-writer",
      allowStructuredRepair: false,
    });
    const saved = m.create.mock.calls[0];
    expect(saved[0].scenes[1].chart.series[0].values).toEqual([42, 68]);
    expect(saved[5].savedOverrides.researchEvidence).toEqual(pack);
    expect(saved[5].savedOverrides.creationSettings.writer).toEqual({
      providerId: "ollama",
      modelId: "fixture-writer",
    });
    expect(m.submit).toHaveBeenCalledTimes(quick ? 1 : 0);
  },
);
it("rejects unsupported numeric copy and empty evidence before saving or silently downgrading", async () => {
  const unsupported = structuredClone(plan);
  unsupported.scenes[0]!.text = "Revenue grew 999%";
  m.generate.mockResolvedValueOnce(unsupported);
  expect((await POST(request())).status).toBe(422);
  expect(m.create).not.toHaveBeenCalled();
  const empty = structuredClone(pack);
  empty.sources = [];
  empty.claims = [];
  m.evidence.mockResolvedValueOnce(empty);
  m.generate.mockClear();
  expect((await POST(request())).status).toBe(400);
  expect(m.generate).not.toHaveBeenCalled();
});
