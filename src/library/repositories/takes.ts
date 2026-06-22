import type { VoiceTakeDTO } from "@/lib/dto";
import type { BeatTiming } from "@/lib/audio-timing";
import { prisma } from "@/library/db";
import { getAssetStore } from "@/library/storage";
import { toTakeDTO } from "./map";

export interface CreateTakeInput {
  scriptId: string;
  label?: string;
  providerId: string;
  voiceId: string;
  modelId?: string;
  fps: number;
  totalFrames: number;
  timeline: BeatTiming[];
  audioPath: string;
  isPlaceholder?: boolean;
}

export async function createTake(
  input: CreateTakeInput,
): Promise<VoiceTakeDTO> {
  const take = await prisma.voiceTake.create({
    data: {
      scriptId: input.scriptId,
      label: input.label,
      providerId: input.providerId,
      voiceId: input.voiceId,
      modelId: input.modelId,
      fps: input.fps,
      totalFrames: input.totalFrames,
      timingJson: JSON.stringify(input.timeline),
      audioPath: input.audioPath,
      isPlaceholder: input.isPlaceholder ?? false,
    },
  });
  return toTakeDTO(take);
}

export async function listTakes(scriptId: string): Promise<VoiceTakeDTO[]> {
  const takes = await prisma.voiceTake.findMany({
    where: { scriptId },
    orderBy: { createdAt: "desc" },
  });
  return takes.map(toTakeDTO);
}

export async function renameTake(id: string, label: string): Promise<void> {
  await prisma.voiceTake.update({ where: { id }, data: { label } });
}

/**
 * Delete a take. This is the ONLY path that removes take audio, and it is
 * explicit/manual only - takes are never auto-deleted because they cost credits.
 */
export async function deleteTake(id: string): Promise<void> {
  const take = await prisma.voiceTake.findUnique({ where: { id } });
  if (!take) return;
  await prisma.voiceTake.delete({ where: { id } });
  await getAssetStore().delete(take.audioPath);
}
