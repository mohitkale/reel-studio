import type { Scene, VoiceTake } from "@prisma/client";

import type { SceneDTO, VoiceTakeDTO } from "@/lib/dto";
import { getAssetStore } from "@/library/storage";
import { emphasisSchema, parseJsonColumn, timelineSchema } from "../schemas";

export function toSceneDTO(scene: Scene): SceneDTO {
  return {
    id: scene.id,
    scriptId: scene.scriptId,
    order: scene.order,
    templateId: scene.templateId,
    text: scene.text,
    emphasis: parseJsonColumn(scene.emphasis, emphasisSchema, []),
    visual: scene.visual ?? undefined,
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
