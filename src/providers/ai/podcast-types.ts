import { z } from "zod";

import { stripMarkdown } from "@/lib/strip-markdown";
import {
  podcastGenderSchema,
  type PodcastLength,
  type PodcastPlan,
} from "@/library/podcast-schemas";

export const podcastAiCharacterSchema = z.object({
  id: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(80),
  gender: podcastGenderSchema.optional().catch("neutral"),
});

export const podcastAiTurnSchema = z.object({
  characterId: z.string().trim().min(1).max(40),
  text: z.string().trim().min(1).max(4000),
});

/** Raw AI JSON before we rematch character ids to the configured cast. */
export const podcastAiPlanSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  characters: z.array(podcastAiCharacterSchema).min(2).max(4).optional(),
  turns: z.array(podcastAiTurnSchema).min(2).max(120),
});

export type { PodcastPlan, PodcastLength };

export interface PodcastCharacterContext {
  key: string;
  name: string;
  gender: string;
  /** Personality / role brief guiding how this speaker sounds in dialogue. */
  definition?: string;
}

export interface GeneratePodcastPlanInput {
  brief: string;
  length: PodcastLength;
  characters: PodcastCharacterContext[];
  modelId?: string;
}

/**
 * Normalize AI output: strip markdown, keep the configured cast, and map
 * turn characterIds onto known keys (case-insensitive / name fallback).
 */
export function normalizePodcastPlan(
  raw: z.infer<typeof podcastAiPlanSchema>,
  cast: PodcastCharacterContext[],
): PodcastPlan {
  const byKey = new Map(cast.map((c) => [c.key.toLowerCase(), c]));
  const byName = new Map(cast.map((c) => [c.name.trim().toLowerCase(), c]));

  function resolveKey(rawId: string): string {
    const id = rawId.trim().toLowerCase();
    const byId = byKey.get(id);
    if (byId) return byId.key;
    const byNm = byName.get(id);
    if (byNm) return byNm.key;
    // fuzzy: strip non-alnum
    const compact = id.replace(/[^a-z0-9]+/g, "");
    for (const c of cast) {
      if (c.key.replace(/[^a-z0-9]+/g, "") === compact) return c.key;
    }
    throw new Error(
      `Unknown characterId "${rawId}". Expected one of: ${cast.map((c) => c.key).join(", ")}`,
    );
  }

  const turns = raw.turns.map((t) => ({
    characterId: resolveKey(t.characterId),
    text: stripMarkdown(t.text).trim(),
  }));

  if (turns.some((t) => !t.text)) {
    throw new Error("Every turn must have non-empty text");
  }

  return {
    title: raw.title ? stripMarkdown(raw.title).trim() : undefined,
    description: raw.description
      ? stripMarkdown(raw.description).trim()
      : undefined,
    characters: cast.map((c) => ({
      id: c.key,
      name: c.name,
      gender: (c.gender as "male" | "female" | "neutral") || "neutral",
    })),
    turns,
  };
}
