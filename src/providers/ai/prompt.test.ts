import { describe, expect, it } from "vitest";

import { buildPrompt } from "@/providers/ai/prompt";

describe("AI production prompts", () => {
  it("asks for exact selective replacements and includes lock context", () => {
    const prompt = buildPrompt({
      mode: "rewrite",
      brief: "Clarify the product workflow",
      sceneCount: 2,
      existingContext:
        "Scene 1 [KEEP COPY]: Existing opening\nScene 2 [REPLACE, KEEP ASSETS]: Existing demo",
      replacementSceneNumbers: [2, 4],
      productionPresetId: "product-launch",
      videoEngine: "hyperframes",
    });

    expect(prompt.system).toContain(
      "Output exactly 2 replacement scenes for positions 2, 4",
    );
    expect(prompt.system).toContain(
      "Use only these capability-mapped templates",
    );
    expect(prompt.user).toContain("Existing scenes and lock state");
    expect(prompt.user).toContain("Replace only scene positions 2, 4");
  });

  it("requests materially different, source-grounded hook alternatives", () => {
    const prompt = buildPrompt({
      mode: "hook_variants",
      brief: "A local video production studio",
      existingContext: "Scene 1: Produce a polished reel locally.",
      productionPresetId: "creator-punch",
      videoEngine: "remotion",
    });

    expect(prompt.system).toContain("exactly 3 alternative opening scenes");
    expect(prompt.user).toContain("three materially different opening options");
    expect(prompt.user).toContain("Do not invent claims");
  });
});
