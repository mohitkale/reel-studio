import type { Scene, VoiceTake } from "@prisma/client";

import type { SceneDTO, SceneBackground, VoiceTakeDTO } from "@/lib/dto";
import { inferSceneMood } from "@/library/enrich-scene-plan";
import { getAssetStore } from "@/library/storage";
import {
  emphasisSchema,
  parseJsonColumn,
  sceneConfigSchema,
  timelineSchema,
} from "../schemas";

/**
 * Legacy migration: the old "image-overlay" template stored its image as JSON
 * in the `visual` column ({"url":...,"effect":...}). Backgrounds are now a
 * first-class per-scene config, so surface that as a background and drop it
 * from `visual` (which is meant for short emoji/label hints).
 */
function legacyVisualBackground(visual: string | null): SceneBackground | null {
  if (!visual || !visual.startsWith("{")) return null;
  try {
    const p = JSON.parse(visual) as { url?: string; effect?: string };
    if (p && typeof p.url === "string" && p.url) {
      return {
        type: "image",
        url: p.url,
        effect: (p.effect as SceneBackground["effect"]) ?? "ken-burns",
      };
    }
  } catch {
    /* not JSON — treat as a plain visual */
  }
  return null;
}

export function toSceneDTO(scene: Scene): SceneDTO {
  const config = parseJsonColumn(scene.layoutJson, sceneConfigSchema, {});
  const legacy = config.background ? null : legacyVisualBackground(scene.visual);
  const background = config.background ?? legacy ?? undefined;
  // Hide the legacy image JSON from the visual field once promoted to background.
  const visual = legacy ? undefined : scene.visual ?? undefined;

  return {
    id: scene.id,
    scriptId: scene.scriptId,
    order: scene.order,
    templateId: scene.templateId,
    text: scene.text,
    emphasis: parseJsonColumn(scene.emphasis, emphasisSchema, []),
    visual,
    background,
    items: config.items && config.items.length ? config.items : undefined,
    hideText: scene.hideText ?? null,
    mood: config.mood ?? inferSceneMood(scene.templateId, scene.order),
    musicMood: config.musicMood,
  };
}

export function toTakeDTO(take: VoiceTake): VoiceTakeDTO {
  return {
    id: take.id,
    scriptId: take.scriptId,
    label: take.label,
    providerId: take.providerId,
    voiceId: take.voiceId,
    modelId: take.modelId,
    fps: take.fps,
    totalFrames: take.totalFrames,
    timeline: parseJsonColumn(take.timingJson, timelineSchema, []),
    audioUrl: getAssetStore().url(take.audioPath),
    isPlaceholder: take.isPlaceholder,
    createdAt: take.createdAt.toISOString(),
  };
}
