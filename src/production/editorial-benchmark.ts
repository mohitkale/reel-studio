import { z } from "zod";
import type { CreativeBrief } from "./editorial";
import { scenePlanSchema, type ScenePlan } from "@/providers/ai/types";
import type { ScriptDTO } from "@/lib/dto";
import type { EvidencePack } from "@/research/contracts";
import { evidenceFixture } from "@/research/fixtures";
import { unsupportedCreationNumbers } from "@/research/creation-grounding";
import { estimateSpeechSeconds } from "@/lib/audio-timing";

export const BENCHMARK_VERSION = "editorial-visual-v1";
export const BENCHMARK_MODES = [
  "baseline",
  "researched-app",
  "researched-mcp",
] as const;
export interface BenchmarkBrief {
  id: string;
  intent: CreativeBrief["intent"];
  brief: string;
  facts: string;
  keywords: string[];
  sourceTitle: string;
  sourceUrl?: string;
  scenes: Array<{ text: string; spokenText: string }>;
}
/** Frozen supplied facts. Synthetic examples are labelled; no live search is implied. */
export const BENCHMARK_BRIEFS: BenchmarkBrief[] = [
  {
    id: "product",
    intent: "product",
    brief:
      "Show source review and supplied visual replacement in Reel Studio. Do not invent customer outcomes.",
    facts:
      "Reel Studio keeps source excerpts visible for review. Supplied product visuals can replace a scene background while retaining approved copy and narration. Supplied artifacts are unverified, not customer evidence.",
    keywords: ["Reel Studio", "source", "supplied", "narration"],
    sourceTitle: "Repository editorial and supplied-proof contracts",
    scenes: [
      {
        text: "Review linked sources.",
        spokenText:
          "In Reel Studio, review source excerpts before approving the script.",
      },
      {
        text: "Replace visuals. Keep copy.",
        spokenText:
          "Replace supplied visuals while retaining approved copy and narration. Verify the artifact yourself.",
      },
    ],
  },
  {
    id: "technical",
    intent: "explainer",
    brief:
      "Explain why reconnecting to an editorial job must not replay spent writing calls.",
    facts:
      "Reel Studio stores editorial request keys and call reservations durably. Reconnect reads the same job. Only unspent work can resume. A failed reserved writing call is not automatically replayed.",
    keywords: ["request key", "reserved", "unspent", "reconnect"],
    sourceTitle: "Repository editorial job contract",
    scenes: [
      {
        text: "Reconnect to the saved job.",
        spokenText:
          "A durable request key reconnects to the saved editorial job and its reserved call.",
      },
      {
        text: "Resume only unspent work.",
        spokenText:
          "Resume only unspent work. A failed reserved writing call is never replayed automatically.",
      },
    ],
  },
  {
    id: "current-topic",
    intent: "news",
    brief:
      "Explain Responses image inputs using the official guidance checked on 30 October 2026. Keep model compatibility uncertain.",
    facts:
      "Guidance checked 30 October 2026: the OpenAI Responses API accepts input_image content with image_url. Requests can include multiple images. Image inputs consume tokens. Model compatibility must be checked explicitly; no universal image support is claimed.",
    keywords: ["Responses", "input_image", "tokens", "compatibility"],
    sourceTitle:
      "OpenAI image-input guidance, snapshot checked 30 October 2026",
    sourceUrl:
      "https://developers.openai.com/api/docs/guides/images-vision?api-mode=responses",
    scenes: [
      {
        text: "Images are request inputs.",
        spokenText:
          "Responses accepts input_image content with image_url, including multiple images.",
      },
      {
        text: "Check model compatibility.",
        spokenText:
          "Image inputs consume tokens. Check model compatibility before making a paid request.",
      },
    ],
  },
  {
    id: "brand",
    intent: "brand",
    brief:
      "Create a calm introduction for Harbor, a fictional notebook brand. Do not invent material or sustainability claims.",
    facts:
      "Synthetic brand brief: Harbor is a fictional notebook brand. Its supplied palette is navy and warm ivory. The message is Make room for the next thought. No performance, material, customer or sustainability evidence is supplied.",
    keywords: ["Harbor", "fictional", "navy", "thought"],
    sourceTitle: "Synthetic Harbor brand brief",
    scenes: [
      {
        text: "Harbor · A fictional brand",
        spokenText:
          "Harbor is a fictional notebook brand, introduced in navy and warm ivory.",
      },
      {
        text: "Make room for the next thought.",
        spokenText:
          "Make room for the next thought. This supplied brand message makes no customer or sustainability claim.",
      },
    ],
  },
  {
    id: "data",
    intent: "data",
    brief:
      "Compare the supplied synthetic draft and review figures. Label them synthetic; do not imply customer uplift.",
    facts:
      "Synthetic dataset, not customer outcomes. Draft: 42%. Review: 68%. These are illustrative review figures and establish no causal or customer outcome.",
    keywords: ["synthetic", "42%", "68%", "customer"],
    sourceTitle: "Synthetic review dataset",
    scenes: [
      {
        text: "Draft: 42%\nReview: 68%",
        spokenText:
          "In this synthetic dataset, draft is 42% and review is 68%.",
      },
      {
        text: "Illustration, not customer proof.",
        spokenText:
          "These illustrative figures establish no causal or customer outcome. Review the underlying evidence before publishing.",
      },
    ],
  },
];
export function benchmarkPlan(
  brief: BenchmarkBrief,
  linked: boolean,
): ScenePlan {
  return scenePlanSchema.parse({
    projectName: brief.brief,
    scriptName: `${brief.id} benchmark`,
    scenes: brief.scenes.map((scene) => ({
      ...scene,
      templateId: "hf-statement",
      emphasis: [],
      evidenceRefs: linked
        ? [{ sourceId: "source-1", excerptId: "excerpt-1" }]
        : [],
    })),
  });
}
export function benchmarkEvidence(brief: BenchmarkBrief): EvidencePack {
  const pack = evidenceFixture();
  pack.createdAt = "2026-10-30T00:00:00.000Z";
  pack.query = brief.brief;
  pack.summary = brief.facts;
  pack.sources[0] = {
    ...pack.sources[0],
    title: brief.sourceTitle,
    url: brief.sourceUrl ?? null,
    retrievedAt: pack.createdAt,
    excerpts: [{ id: "excerpt-1", text: brief.facts, kind: "source_text" }],
  };
  pack.claims = [];
  pack.gaps = [
    "Frozen supplied source snapshot; linkage does not verify semantic truth.",
  ];
  return pack;
}
/** Each count has a narrow observable meaning; none is a semantic quality score. */
export function benchmarkMetrics(brief: BenchmarkBrief, script: ScriptDTO) {
  const copy = script.scenes
    .map((s) => `${s.text}\n${s.spokenText ?? s.text}`)
    .join("\n");
  const shots = script.editorialStoryboard?.shots ?? [];
  const evidence = script.researchEvidence;
  const linked = script.scenes.filter((scene) => {
    const shot = shots.find(
      (s) =>
        s.sceneId === scene.id &&
        s.narration === (scene.spokenText ?? scene.text),
    );
    return (
      shot?.references.some((ref) =>
        evidence?.sources.some(
          (source) =>
            source.id === ref.sourceId &&
            source.excerpts.some((excerpt) => excerpt.id === ref.excerptId),
        ),
      ) ?? false
    );
  }).length;
  const plan = scenePlanSchema.parse({
    projectName: "Benchmark",
    scriptName: "Benchmark",
    scenes: script.scenes.map((s) => ({
      text: s.text,
      spokenText: s.spokenText ?? undefined,
      templateId: "hf-statement",
      emphasis: [],
    })),
  });
  const narrations = script.scenes.map((s) =>
    (s.spokenText ?? s.text).toLowerCase().replace(/\s+/g, " ").trim(),
  );
  return {
    scenes: script.scenes.length,
    linkedSceneFraction: linked / Math.max(1, script.scenes.length),
    unsupportedNumericTokens: unsupportedCreationNumbers(plan, [
      brief.brief,
      brief.facts,
    ]),
    specificityKeywordFraction:
      brief.keywords.filter((word) =>
        copy.toLowerCase().includes(word.toLowerCase()),
      ).length / brief.keywords.length,
    repeatedNarrations: narrations.length - new Set(narrations).size,
    estimatedNarrationSeconds: script.scenes.reduce(
      (sum, scene) =>
        sum + estimateSpeechSeconds(scene.spokenText ?? scene.text),
      0,
    ),
    suppliedProofScenes: script.scenes.filter(
      (s) => s.proof?.sourceStatus === "supplied_unverified",
    ).length,
    semanticVisualRelevance: null,
    humanNarrativeQuality: null,
    humanRepairEdits: null,
  };
}
export const benchmarkReviewSchema = z
  .object({
    version: z.literal(1),
    runId: z.string().min(1).max(100),
    reviews: z
      .array(
        z
          .object({
            scriptId: z.string().min(1).max(160),
            outputChecksum: z.string().regex(/^sha256:[a-f0-9]{64}$/),
            status: z.enum(["pending", "accepted", "needs-repair"]),
            reviewer: z.string().trim().min(1).max(160).nullable(),
            factualSupport: z.number().int().min(1).max(5).nullable(),
            specificity: z.number().int().min(1).max(5).nullable(),
            narrative: z.number().int().min(1).max(5).nullable(),
            visualRelevance: z.number().int().min(1).max(5).nullable(),
            pacing: z.number().int().min(1).max(5).nullable(),
            manualEdits: z.number().int().nonnegative().nullable(),
            notes: z.string().max(4000),
          })
          .strict(),
      )
      .max(15),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      new Set(value.reviews.map((r) => r.scriptId)).size !==
      value.reviews.length
    )
      ctx.addIssue({ code: "custom", message: "Duplicate script review" });
    for (const review of value.reviews)
      if (
        review.status !== "pending" &&
        (!review.reviewer ||
          [
            review.factualSupport,
            review.specificity,
            review.narrative,
            review.visualRelevance,
            review.pacing,
            review.manualEdits,
          ].some((v) => v === null))
      )
        ctx.addIssue({
          code: "custom",
          message:
            "Completed reviews require a reviewer and every rating/edit count",
        });
  });
