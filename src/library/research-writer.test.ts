// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { planWithResearchEvidence } from "./research-writer";
import { evidenceFixture } from "@/research/fixtures";
import { createOllamaProvider } from "@/providers/ai/ollama";
import { createLocalCompatibleProvider } from "@/providers/ai/lm-studio";
import type { LocalAIProviderId } from "@/providers/ai/local-definitions";
import { normalizeOpenAIResearch } from "@/providers/research/openai";
import { normalizeResearchRequest } from "./research-service";
import grounded from "@/providers/research/fixtures/openai-grounded.json";

const writerRequest = (providerId: LocalAIProviderId) => ({
  writer: { providerId, modelId: "fixture-7b-instruct" },
  research: { mode: "supplied" },
  mode: "idea",
  brief: "Explain the supplied product facts",
  budget: { maxLocalCalls: 1, deadlineMs: 10_000 },
});
const store = () => ({
  readProvider: vi.fn(async () => ({
    baseUrl: "http://127.0.0.1:11434",
    modelId: "fixture-7b-instruct",
    temperature: 0.2,
    maxOutputTokens: 2048,
    contextWindow: 16_384,
    allowLan: false,
  })),
  recordDiagnostic: vi.fn(async () => undefined),
});
const plan = {
  projectName: "Evidence fixture",
  scriptName: "Local writer",
  styleId: "clean-story",
  energy: "normal",
  scenes: [
    {
      text: "A local-first editor.",
      capabilityId: "hf.template.statement",
      emphasis: [],
    },
  ],
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function fixtureTransport(providerId: LocalAIProviderId, invalid = false) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    expect(new URL(url).hostname).toBe("127.0.0.1");
    if ((init?.method ?? "GET") === "GET")
      return providerId === "ollama"
        ? Response.json({
            models: [
              { name: "fixture-7b-instruct", model: "fixture-7b-instruct" },
            ],
          })
        : Response.json({ data: [{ id: "fixture-7b-instruct" }] });
    const body = JSON.parse(String(init?.body));
    expect(body.messages[0].content).toContain("untrusted reference data");
    expect(body.messages[1].content).toContain("A local-first editor.");
    expect(body.messages[1].content).toContain('"source-1"');
    expect(body.model).toBe("fixture-7b-instruct");
    const content = invalid
      ? "invalid structured output"
      : JSON.stringify(plan);
    return providerId === "ollama"
      ? Response.json({ message: { content } })
      : Response.json({ choices: [{ message: { content } }] });
  });
}

describe("explicit local evidence writers", () => {
  it.each(["ollama", "lm-studio", "llama-cpp"] as const)(
    "%s consumes supplied evidence offline through its real transport",
    async (providerId) => {
      vi.stubEnv("GEMINI_API_KEY", "");
      vi.stubEnv("OPENAI_API_KEY", "");
      const fetcher = fixtureTransport(providerId);
      vi.stubGlobal("fetch", fetcher);
      const provider =
        providerId === "ollama"
          ? createOllamaProvider(store())
          : createLocalCompatibleProvider(providerId, store());
      const result = await planWithResearchEvidence(
        evidenceFixture(),
        writerRequest(providerId),
        { getProvider: vi.fn(() => provider) },
      );
      expect(result.plan.projectName).toBe("Evidence fixture");
      expect(result.usage).toEqual({
        localWriterCalls: 1,
        newProviderCalls: 0,
        newSearchChargeUnits: 0,
      });
      expect(result.writer).toEqual(writerRequest(providerId).writer);
      expect(
        fetcher.mock.calls.filter(([, init]) => init?.method === "POST"),
      ).toHaveLength(1);
    },
  );
  it.each(["ollama", "lm-studio", "llama-cpp"] as const)(
    "%s cannot silently exceed its one-call budget through repair",
    async (providerId) => {
      const fetcher = fixtureTransport(providerId, true);
      vi.stubGlobal("fetch", fetcher);
      const provider =
        providerId === "ollama"
          ? createOllamaProvider(store())
          : createLocalCompatibleProvider(providerId, store());
      await expect(
        planWithResearchEvidence(evidenceFixture(), writerRequest(providerId), {
          getProvider: () => provider,
        }),
      ).rejects.toThrow("invalid structured output");
      expect(
        fetcher.mock.calls.filter(([, init]) => init?.method === "POST"),
      ).toHaveLength(1);
    },
  );
  it("requires an explicit matching researcher/model for saved native evidence", async () => {
    const evidence = normalizeOpenAIResearch(
      grounded,
      normalizeResearchRequest({
        idempotencyKey: "writer-research",
        query: "Product facts",
        mode: "web",
        providerId: "openai",
        budget: {
          maxProviderCalls: 1,
          maxSearchChargeUnits: 1,
          deadlineMs: 10_000,
          maxOutputTokens: 1024,
        },
      }),
    );
    const generatePlan = vi.fn(async () => ({
      projectName: "Local draft",
      scriptName: "Script",
      scenes: [],
    }));
    const getProvider = vi.fn(() => ({
      ...createOllamaProvider(store()),
      generatePlan,
    }));
    await expect(
      planWithResearchEvidence(evidence, writerRequest("ollama"), {
        getProvider,
      }),
    ).rejects.toThrow("explicit shared");
    await expect(
      planWithResearchEvidence(
        evidence,
        {
          ...writerRequest("ollama"),
          research: {
            mode: "shared",
            providerId: "gemini",
            modelId: "gemini-2.5-flash",
          },
        },
        { getProvider },
      ),
    ).rejects.toThrow("No backend was substituted");
    expect(getProvider).not.toHaveBeenCalled();
    vi.stubEnv("OPENAI_API_KEY", "");
    const result = await planWithResearchEvidence(
      evidence,
      {
        ...writerRequest("ollama"),
        research: {
          mode: "shared",
          providerId: "openai",
          modelId: "gpt-4.1-mini",
        },
      },
      { getProvider },
    );
    expect(result.evidenceId).toBe(evidence.id);
    expect(result.attribution.required).toBe(true);
    expect(result.disclosure).toContain("No new cloud research call");
    expect(generatePlan).toHaveBeenCalledOnce();
  });
  it("rejects missing selection, malformed references and oversized context before calling a writer", async () => {
    const getProvider = vi.fn();
    await expect(
      planWithResearchEvidence(
        evidenceFixture(),
        { ...writerRequest("ollama"), research: undefined },
        { getProvider },
      ),
    ).rejects.toThrow();
    await expect(
      planWithResearchEvidence(
        evidenceFixture(),
        { ...writerRequest("ollama"), budget: { maxLocalCalls: 0 } },
        { getProvider },
      ),
    ).rejects.toThrow();
    const invalid = evidenceFixture();
    invalid.claims[0].references[0].sourceId = "missing";
    await expect(
      planWithResearchEvidence(invalid, writerRequest("ollama"), {
        getProvider,
      }),
    ).rejects.toThrow();
    const large = evidenceFixture();
    large.sources[0].excerpts = Array.from({ length: 4 }, (_, i) => ({
      id: `large-${i}`,
      text: "x".repeat(8000),
      kind: "source_text" as const,
    }));
    large.claims = [];
    await expect(
      planWithResearchEvidence(large, writerRequest("ollama"), { getProvider }),
    ).rejects.toThrow("24,000-character");
    expect(getProvider).not.toHaveBeenCalled();
  });
  it("never falls back to cloud research when the selected local writer is offline", async () => {
    const provider = {
      ...createOllamaProvider(store()),
      generatePlan: vi.fn(async () => {
        throw new Error("Local writer offline");
      }),
    };
    const getProvider = vi.fn(() => provider);
    await expect(
      planWithResearchEvidence(evidenceFixture(), writerRequest("ollama"), {
        getProvider,
      }),
    ).rejects.toThrow("offline");
    expect(getProvider).toHaveBeenCalledExactlyOnceWith("ollama");
  });
});
