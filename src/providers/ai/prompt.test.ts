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
    expect(prompt.system).toContain("Use only these capability IDs");
    expect(prompt.user).toContain("Existing scenes and lock state");
    expect(prompt.user).toContain("Replace only scene positions 2, 4");
  });

  it("requests materially different, source-grounded hook alternatives", () => {
    const prompt = buildPrompt({
      mode: "hook_variants",
      brief: "A local video production studio",
      existingContext: "Scene 1: Produce a polished reel locally.",
      productionPresetId: "creator-punch",
      videoEngine: "hyperframes",
    });

    expect(prompt.system).toContain("exactly 3 alternative opening scenes");
    expect(prompt.user).toContain("three materially different opening options");
    expect(prompt.user).toContain("Do not invent claims");
  });

  it("limits AI media output to search intent and honors explicit preference", () => {
    const prompt = buildPrompt({
      mode: "idea",
      brief: "Ocean conservation",
      mediaPreference: "video",
    });
    expect(prompt.system).toContain(
      "Never return a URL, provider id, or asset id",
    );
    expect(prompt.system).toContain("mediaKind must be video");
  });
});

it("asks for a bounded named chapter arc with earlier work preserved", () => {
  const prompt = buildPrompt({
    mode: "append",
    brief: "Supplied workflow facts",
    sceneCount: 4,
    chapterTitle: "The proof",
    existingSceneCount: 40,
    existingContext: "Context only: Scene 40: Prior takeaway",
  });
  expect(prompt.system).toContain("4");
  expect(prompt.user).toContain(
    'chapter titled "The proof", starting at scene 41',
  );
  expect(prompt.user).toContain("one small arc");
  expect(prompt.user).toContain("Do not rewrite earlier chapters");
  expect(prompt.user).toContain("Prior takeaway");
});

it("plans source-grounded chapter briefs through the existing structured scene carrier for HyperFrames", () => {
  for (const videoEngine of ["hyperframes"] as const) {
    const prompt = buildPrompt({
      mode: "chapter_outline",
      brief: "Supplied source",
      sceneCount: 2,
      videoEngine,
      existingContext: "Prior chapters",
    });
    expect(prompt.system).toContain("exactly 2 entries");
    expect(prompt.system).toContain("not a finished scene");
    expect(prompt.system).toContain("never invent statistics");
    expect(prompt.system).toContain("Omit media, charts and visual fields");
    expect(prompt.user).toContain("Supplied source");
    expect(prompt.user).toContain("Prior chapters");
  }
});
