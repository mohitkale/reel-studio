import type { SceneVoiceClipDTO } from "@/lib/dto";
import { prisma } from "@/library/db";
import { ProviderError } from "@/providers/voice/types";
import { getAssetStore } from "@/library/storage";
import { toVoiceClipDTO } from "./map";

export interface CreateSceneClipInput {
  scriptId: string;
  sceneId: string;
  providerId: string;
  voiceId: string;
  modelId?: string;
  text: string;
  textHash: string;
  audioPath: string;
  durationFrames: number;
  fps: number;
  label?: string;
  isPlaceholder?: boolean;
}

export async function createSceneClip(
  input: CreateSceneClipInput,
): Promise<SceneVoiceClipDTO> {
  const clip = await prisma.sceneVoiceClip.create({
    data: {
      scriptId: input.scriptId,
      sceneId: input.sceneId,
      providerId: input.providerId,
      voiceId: input.voiceId,
      modelId: input.modelId,
      text: input.text,
      textHash: input.textHash,
      audioPath: input.audioPath,
      durationFrames: input.durationFrames,
      fps: input.fps,
      label: input.label,
      isPlaceholder: input.isPlaceholder ?? false,
    },
  });
  return toVoiceClipDTO(clip);
}

export async function listSceneClips(
  scriptId: string,
): Promise<SceneVoiceClipDTO[]> {
  const clips = await prisma.sceneVoiceClip.findMany({
    where: { scriptId },
    orderBy: { createdAt: "desc" },
  });
  return clips.map(toVoiceClipDTO);
}

export async function listSceneClipsForScene(
  sceneId: string,
): Promise<SceneVoiceClipDTO[]> {
  const clips = await prisma.sceneVoiceClip.findMany({
    where: { sceneId },
    orderBy: { createdAt: "desc" },
  });
  return clips.map(toVoiceClipDTO);
}

export async function getSceneClip(
  id: string,
): Promise<SceneVoiceClipDTO | null> {
  const clip = await prisma.sceneVoiceClip.findUnique({ where: { id } });
  return clip ? toVoiceClipDTO(clip) : null;
}

export async function selectSceneClip(
  sceneId: string,
  clipId: string | null,
): Promise<void> {
  if (clipId !== null) {
    const clip = await prisma.sceneVoiceClip.findUnique({
      where: { id: clipId },
      select: { sceneId: true },
    });
    if (!clip || clip.sceneId !== sceneId) {
      throw new ProviderError("Voice clip does not belong to this scene", 400);
    }
  }
  await prisma.scene.update({
    where: { id: sceneId },
    data: { selectedVoiceClipId: clipId },
  });
}

/**
 * Delete a scene voice clip. Explicit/manual only — clips cost TTS credits.
 */
export async function deleteSceneClip(id: string): Promise<void> {
  const clip = await prisma.sceneVoiceClip.findUnique({ where: { id } });
  if (!clip) return;
  await prisma.sceneVoiceClip.delete({ where: { id } });
  await getAssetStore().delete(clip.audioPath);
}
