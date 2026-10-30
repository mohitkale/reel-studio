import { expect, it } from "vitest";
import {
  BENCHMARK_BRIEFS,
  benchmarkEvidence,
  benchmarkPlan,
  benchmarkMetrics,
  benchmarkReviewSchema,
} from "./editorial-benchmark";
import { admitEditorialScript } from "@/library/editorial-writing";
import { editorialCreationRequestSchema } from "./editorial";
import { evidencePackSchema } from "@/research/contracts";
import type { ScriptDTO } from "@/lib/dto";

it("admits every frozen brief with exact source links and supported numbers", () => {
  expect(new Set(BENCHMARK_BRIEFS.map((b) => b.intent)).size).toBe(5);
  for (const brief of BENCHMARK_BRIEFS) {
    const evidence = evidencePackSchema.parse(benchmarkEvidence(brief));
    const request = editorialCreationRequestSchema.parse({
      idempotencyKey: `benchmark:${brief.id}`,
      brief: `${brief.brief}\n${brief.facts}`,
      creativeBrief: {
        intent: brief.intent,
        audience: "Creators",
        goal: brief.brief,
        language: "English",
        targetSeconds: 15,
        tone: "Measured",
        takeaway: brief.scenes[1].text,
      },
      providerId: "ollama",
      modelId: "fixture",
      evidenceId: evidence.id,
      budget: { maxProviderCalls: 1, deadlineMs: 30000 },
    });
    const linked = admitEditorialScript(
      benchmarkPlan(brief, true),
      request,
      evidence,
    );
    const copy = linked.beats
      .map((beat) => `${beat.headline} ${beat.narration}`)
      .join(" ")
      .toLowerCase();
    expect(
      brief.keywords.every((word) => copy.includes(word.toLowerCase())),
    ).toBe(true);
    expect(linked.beats.every((beat) => beat.references.length === 1)).toBe(
      true,
    );
    expect(benchmarkPlan(brief, false).scenes.map((s) => s.text)).toEqual(
      linked.beats.map((b) => b.headline),
    );
    const bad = benchmarkPlan(brief, true);
    bad.scenes[0].evidenceRefs = [
      { sourceId: "absent", excerptId: "excerpt-1" },
    ];
    expect(() => admitEditorialScript(bad, request, evidence)).toThrow(
      /reference/,
    );
  }
});

it("does not count stale or foreign references as factual support or infer human ratings", () => {
  const brief = BENCHMARK_BRIEFS[0];
  const script = {
    scenes: [
      {
        id: "scene",
        text: brief.scenes[0].text,
        spokenText: brief.scenes[0].spokenText,
      },
    ],
    researchEvidence: benchmarkEvidence(brief),
    editorialStoryboard: {
      shots: [
        {
          sceneId: "scene",
          narration: "Older narration",
          references: [{ sourceId: "source-1", excerptId: "excerpt-1" }],
        },
      ],
    },
  } as unknown as ScriptDTO;
  expect(benchmarkMetrics(brief, script)).toMatchObject({
    linkedSceneFraction: 0,
    semanticVisualRelevance: null,
    humanNarrativeQuality: null,
    humanRepairEdits: null,
  });
  script.editorialStoryboard!.shots[0].narration = brief.scenes[0].spokenText;
  expect(benchmarkMetrics(brief, script).linkedSceneFraction).toBe(1);
  script.editorialStoryboard!.shots[0].references[0].sourceId = "foreign";
  expect(benchmarkMetrics(brief, script).linkedSceneFraction).toBe(0);
});

it("requires a named reviewer and all scores before accepting a checksummed export", () => {
  const item = {
    scriptId: "script",
    outputChecksum: `sha256:${"a".repeat(64)}`,
    status: "pending",
    reviewer: null,
    factualSupport: null,
    specificity: null,
    narrative: null,
    visualRelevance: null,
    pacing: null,
    manualEdits: null,
    notes: "Watch the full export",
  };
  const input = { version: 1, runId: "run", reviews: [item] };
  expect(benchmarkReviewSchema.safeParse(input).success).toBe(true);
  expect(
    benchmarkReviewSchema.safeParse({
      ...input,
      reviews: [{ ...item, status: "accepted" }],
    }).success,
  ).toBe(false);
  const accepted = {
    ...item,
    status: "accepted",
    reviewer: "Human reviewer",
    factualSupport: 4,
    specificity: 4,
    narrative: 4,
    visualRelevance: 3,
    pacing: 4,
    manualEdits: 0,
  };
  expect(
    benchmarkReviewSchema.safeParse({ ...input, reviews: [accepted] }).success,
  ).toBe(true);
  expect(
    benchmarkReviewSchema.safeParse({ ...input, reviews: [accepted, accepted] })
      .success,
  ).toBe(false);
});
