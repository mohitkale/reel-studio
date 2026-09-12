import { z } from "zod";

import { VIDEO_ENGINE_IDS, type VideoEngineId } from "@/engines/types";
import { defaultTemplateIdForEngine } from "@/engines/registry";
import { ORIENTATIONS } from "@/lib/orientation";
import { getPresetTemplateId } from "@/production/preset-template-map";
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
  return scenes;
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

function rolesForPreset(
  presetId: ProductionPresetId,
  count: number,
  hasVisualAsset: boolean,
): ProductionSceneRole[] {
  const preset = getProductionPreset(presetId);
  if (!preset) throw new Error(`Unknown production preset: ${presetId}`);
  let candidates = [...preset.sceneRoles];
  if (!hasVisualAsset) {
    candidates = candidates.filter(
      (role) =>
        role !== "screenshot-demo" && role !== "browser" && role !== "hero",
    );
  }
  // Automatic prose planning never invents structured data.
  if (presetId === "data-story") candidates = ["takeaway"];
  if (!candidates.length) candidates = [...preset.sceneRoles];

  return Array.from({ length: count }, (_, index) => {
    if (index === 0) return candidates[0]!;
    if (index === count - 1) return candidates[candidates.length - 1]!;
    return (
      candidates[1 + ((index - 1) % Math.max(1, candidates.length - 2))] ??
      candidates[0]!
    );
  });
}

export function createDeterministicProductionPlan(args: {
  name: string;
  text: string;
  presetId: ProductionPresetId;
  videoEngine: VideoEngineId;
  hasVisualAsset: boolean;
}): ManualProductionPlan {
  const preset = getProductionPreset(args.presetId);
  if (!preset) throw new Error(`Unknown production preset: ${args.presetId}`);
  const segments = segmentSourceText(args.text);
  const roles = rolesForPreset(
    args.presetId,
    segments.length,
    args.hasVisualAsset,
  );
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
  return {
    plan,
    roles,
    preset: { id: preset.id, version: preset.version },
    warnings: shortened
      ? [
          "Long source passages use shorter display copy; the complete wording is retained as narration.",
        ]
      : [],
  };
}
