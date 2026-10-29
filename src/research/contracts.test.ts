import { describe, expect, it } from "vitest";
import { evidencePackSchema, researchRequestSchema } from "./contracts";
import { researchCapability } from "./capabilities";

import { evidenceFixture } from "./fixtures";

describe("evidence contracts", () => {
  it("preserves provenance without asserting truth", () => {
    const pack = evidenceFixture();
    pack.provenance.kind = "external_unverified";
    pack.sources[0].provenance = "external_unverified";
    pack.sources[0].url = "https://example.com/brief";
    expect(evidencePackSchema.parse(pack).provenance.kind).toBe(
      "external_unverified",
    );
  });
  it("rejects dangling and cross-source excerpt references", () => {
    const pack = evidenceFixture();
    pack.claims[0].references[0].sourceId = "missing";
    expect(evidencePackSchema.safeParse(pack).success).toBe(false);
    pack.claims[0].references[0].sourceId = "source-1";
    pack.claims[0].references[0].excerptId = "missing";
    expect(evidencePackSchema.safeParse(pack).success).toBe(false);
  });
  it("rejects duplicate IDs, invalid conflicts, unsafe schemes and versions", () => {
    const pack = evidenceFixture();
    expect(evidencePackSchema.safeParse({ ...pack, version: 2 }).success).toBe(
      false,
    );
    expect(
      evidencePackSchema.safeParse({
        ...pack,
        claims: [...pack.claims, ...pack.claims],
      }).success,
    ).toBe(false);
    pack.conflicts = [
      {
        id: "conflict-1",
        description: "Disagreement",
        claimIds: ["claim-1", "missing"],
      },
    ];
    expect(evidencePackSchema.safeParse(pack).success).toBe(false);
    pack.conflicts = [];
    pack.sources[0].url = "javascript:alert(1)";
    expect(evidencePackSchema.safeParse(pack).success).toBe(false);
  });
  it("requires explicit cloud selection and both usage allowances", () => {
    const input = {
      idempotencyKey: "research-1",
      query: "Latest product facts",
      mode: "web",
      providerId: "gemini",
    };
    expect(researchRequestSchema.safeParse(input).success).toBe(false);
    expect(
      researchRequestSchema.safeParse({
        ...input,
        budget: {
          maxProviderCalls: 1,
          maxSearchChargeUnits: 1,
          deadlineMs: 10_000,
          maxOutputTokens: 1024,
        },
      }).success,
    ).toBe(true);
  });
  it("does not infer search capability from model discovery or provider name", () => {
    expect(researchCapability("gemini", "gemini-2.5-flash").nativeSearch).toBe(
      true,
    );
    for (const provider of ["openai", "ollama", "lm-studio", "llama-cpp"])
      expect(researchCapability(provider, "discovered-model")).toMatchObject({
        nativeSearch: false,
        sharedBackend: provider !== "openai",
        suppliedSources: true,
      });
    expect(researchCapability("gemini", "gemini-3.8-flash").nativeSearch).toBe(
      false,
    );
  });
});
