import { z } from "zod";

import { VIDEO_ENGINE_IDS, type VideoEngineId } from "@/engines/types";
import { defaultTemplateIdForEngine } from "@/engines/registry";
import { ORIENTATIONS } from "@/lib/orientation";
import { mediaPreferenceSchema } from "@/lib/media-preference";
import { getPresetTemplateId } from "@/production/preset-template-map";
import { resolvePresetRoles } from "@/production/ai-preset-plan";
import {
  getProductionPreset,
  productionPresetIdSchema,
  type ProductionPresetId,
} from "@/production/presets";
import type { ProductionSceneRole } from "@/production/roles";
import { scenePlanSchema, type ScenePlan } from "@/providers/ai/types";

export const manualCreationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  outputType: z.enum(["video", "voiceover"]).default("video"),
  source: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("text"),
      text: z.string().trim().min(20).max(12_000),
    }),
    z.object({ kind: z.literal("url"), url: z.string().url().max(2_048) }),
  ]),
  presetId: productionPresetIdSchema,
  orientation: z.enum(ORIENTATIONS),
  videoEngine: z.enum(VIDEO_ENGINE_IDS),
  brandKitId: z.string().min(1).nullable().optional(),
  voiceMode: z.enum(["oneshot", "per_scene"]).default("oneshot"),
  mediaPreference: mediaPreferenceSchema.default("auto"),
  assetIds: z.array(z.string().min(1).max(160)).max(12).default([]),
});
export type ManualCreationInput = z.input<typeof manualCreationSchema>;

export interface ManualProductionPlan {
  plan: ScenePlan;
  roles: ProductionSceneRole[];
  preset: { id: ProductionPresetId; version: string };
  warnings: string[];
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sentencePieces(text: string): string[] {
  const paragraphs = normalizeText(text)
    .split(/\n{2,}/)
    .filter(Boolean);
  return paragraphs.flatMap((paragraph) => {
    const segments = Array.from(
      new Intl.Segmenter(undefined, { granularity: "sentence" }).segment(
        paragraph,
      ),
      ({ segment }) => segment.trim(),
    ).filter(Boolean);
    return segments.length ? segments : [paragraph];
  });
}

function splitLongPiece(piece: string, maxChars: number): string[] {
  if (Array.from(piece).length <= maxChars) return [piece];
  const words = piece.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (Array.from(candidate).length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    const glyphs = Array.from(word);
    while (glyphs.length > maxChars)
      chunks.push(glyphs.splice(0, maxChars).join(""));
    current = glyphs.join("");
  }
  if (current) chunks.push(current);
  return chunks;
}

function capSceneCount(scenes: string[], maxScenes: number): string[] {
  const capped = [...scenes];
  while (capped.length > maxScenes) {
    let shortestPairIndex = 0;
    let shortestPairLength = Number.POSITIVE_INFINITY;
    for (let index = 0; index < capped.length - 1; index += 1) {
      const pairLength = Array.from(
        `${capped[index]} ${capped[index + 1]}`,
      ).length;
      if (pairLength < shortestPairLength) {
        shortestPairIndex = index;
        shortestPairLength = pairLength;
      }
    }
    capped.splice(
      shortestPairIndex,
      2,
      `${capped[shortestPairIndex]} ${capped[shortestPairIndex + 1]}`,
    );
  }
  return capped;
}

/** Preserve every source character while producing at most 20 narration scenes. */
export function segmentSourceText(text: string): string[] {
  const normalized = normalizeText(text);
  const maxChars = Math.max(260, Math.ceil(Array.from(normalized).length / 20));
  const pieces = sentencePieces(normalized).flatMap((piece) =>
    splitLongPiece(piece, maxChars),
  );
  const scenes: string[] = [];
  let current = "";
  for (const piece of pieces) {
    const candidate = current ? `${current} ${piece}` : piece;
    if (current && Array.from(candidate).length > maxChars) {
      scenes.push(current);
      current = piece;
    } else {
      current = candidate;
    }
  }
  if (current) scenes.push(current);
  return capSceneCount(scenes, 20);
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function splitForShortScenes(piece: string, maxWords = 28): string[] {
  const words = piece.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return [piece];
  const chunks: string[] = [];
  for (let index = 0; index < words.length; index += maxWords) {
    chunks.push(words.slice(index, index + maxWords).join(" "));
  }
  return chunks;
}

function polishedSentenceScore(
  sentence: string,
  index: number,
  total: number,
): number {
  const words = wordCount(sentence);
  const position = total <= 1 ? 0 : index / (total - 1);
  let score = words >= 8 && words <= 26 ? 4 : words <= 32 ? 2 : 0;
  if (/[?]$/.test(sentence)) score += 1.5;
  if (
    /\b(?:but|because|real|important|matters?|instead|question|need|should)\b/i.test(
      sentence,
    )
  ) {
    score += 1;
  }
  if (/\d|%|×|\bx\b/i.test(sentence)) score += 0.5;
  if (/[:：]\s*$/.test(sentence)) score -= 3;
  if (/^(?:it|that|these|they|this|those)\b/i.test(sentence)) score -= 2;
  if (
    /\b(?:ultimately|finally|judgment|takeaway|lesson|therefore)\b/i.test(
      sentence,
    )
  ) {
    score += 1;
  }
  if (index === total - 1) score += 2;
  if (position < 0.08 || position > 0.9) score += 1;
  if (words < 5) score -= 4;
  return score;
}

/**
 * Extract a paced short-form cut from long source material. Unlike
 * voiceover-first mode this is intentionally selective: one strong sentence
 * per narrative section, in source order, with short scene-sized beats.
 */
export function segmentPolishedVideoText(text: string): string[] {
  const normalized = normalizeText(text);
  const all = sentencePieces(normalized).filter(
    (piece) => wordCount(piece) >= 3,
  );
  if (!all.length) return [normalized];

  const sourceWords = wordCount(normalized);
  let selected = all;
  if (sourceWords > 180 || all.length > 12) {
    const targetScenes = Math.min(
      10,
      Math.max(6, Math.round(sourceWords / 100)),
    );
    selected = Array.from({ length: targetScenes }, (_, bucket) => {
      const start = Math.floor((bucket * all.length) / targetScenes);
      const end = Math.max(
        start + 1,
        Math.floor(((bucket + 1) * all.length) / targetScenes),
      );
      return all
        .slice(start, end)
        .map((sentence, offset) => ({
          sentence,
          score: polishedSentenceScore(sentence, start + offset, all.length),
        }))
        .sort((a, b) => b.score - a.score)[0]!.sentence;
    });
  }

  const deduped = selected.filter(
    (sentence, index) =>
      selected.findIndex(
        (candidate) => candidate.toLowerCase() === sentence.toLowerCase(),
      ) === index,
  );
  return capSceneCount(
    deduped.flatMap((piece) => splitForShortScenes(piece)),
    12,
  );
}

function displayCopy(narration: string): { text: string; shortened: boolean } {
  const words = narration.split(/\s+/).filter(Boolean);
  if (words.length <= 18 && Array.from(narration).length <= 150) {
    return { text: narration, shortened: false };
  }
  const text = words
    .slice(0, 18)
    .join(" ")
    .replace(/[,:;–—-]+$/, "");
  return { text: `${text}…`, shortened: true };
}

export function createDeterministicProductionPlan(args: {
  name: string;
  text: string;
  outputType?: "video" | "voiceover";
  presetId: ProductionPresetId;
  videoEngine: VideoEngineId;
  hasVisualAsset: boolean;
}): ManualProductionPlan {
  const preset = getProductionPreset(args.presetId);
  if (!preset) throw new Error(`Unknown production preset: ${args.presetId}`);
  const segments =
    args.outputType === "voiceover"
      ? segmentSourceText(args.text)
      : segmentPolishedVideoText(args.text);
  const roles = resolvePresetRoles(args.presetId, segments.length, {
    hasVisualAsset: args.hasVisualAsset,
  });
  let shortened = false;
  const scenes = segments.map((narration, index) => {
    const display = displayCopy(narration);
    shortened ||= display.shortened;
    const role = roles[index]!;
    return {
      templateId:
        getPresetTemplateId({
          presetId: args.presetId,
          engineId: args.videoEngine,
          role,
        }) ?? defaultTemplateIdForEngine(args.videoEngine),
      text: display.text,
      spokenText: narration === display.text ? undefined : narration,
      emphasis: [],
      musicMood: preset.defaults.musicMood,
    };
  });

  const plan = scenePlanSchema.parse({
    projectName: args.name,
    scriptName: `${args.name} script`,
    styleId: preset.defaults.styleId,
    energy: preset.defaults.energy,
    scenes,
  });
  const condensed =
    args.outputType !== "voiceover" &&
    normalizeText(args.text).replace(/\s+/g, " ") !==
      segments.join(" ").replace(/\s+/g, " ");
  return {
    plan,
    roles,
    preset: { id: preset.id, version: preset.version },
    warnings: [
      ...(condensed
        ? [
            "The polished-video cut selects the strongest source passages for short-form pacing. Choose Voiceover-first to retain every passage.",
          ]
        : []),
      ...(shortened
        ? ["Long narration beats use shorter display copy for readability."]
        : []),
    ],
  };
}
