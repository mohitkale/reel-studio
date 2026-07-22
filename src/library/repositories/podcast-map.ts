import type {
  PodcastCharacter,
  PodcastTake,
  PodcastTurn,
} from "@prisma/client";

import type {
  PodcastBeatTimingDTO,
  PodcastCharacterDTO,
  PodcastGenderDTO,
  PodcastLengthDTO,
  PodcastTakeDTO,
  PodcastTurnDTO,
} from "@/lib/dto";
import { getAssetStore } from "@/library/storage";
import {
  podcastGenderSchema,
  podcastLengthSchema,
  podcastTimelineSchema,
} from "@/library/podcast-schemas";
import { parseJsonColumn } from "@/library/schemas";

type TurnWithCharacter = PodcastTurn & {
  character: PodcastCharacter;
};

function resolveLength(raw: string): PodcastLengthDTO {
  const parsed = podcastLengthSchema.safeParse(raw);
  return parsed.success ? parsed.data : "short";
}

function resolveGender(raw: string): PodcastGenderDTO {
  const parsed = podcastGenderSchema.safeParse(raw);
  return parsed.success ? parsed.data : "neutral";
}

export function toPodcastCharacterDTO(
  c: PodcastCharacter,
): PodcastCharacterDTO {
  return {
    id: c.id,
    podcastId: c.podcastId,
    key: c.key,
    name: c.name,
    gender: resolveGender(c.gender),
    definition: c.definition ?? "",
    providerId: c.providerId,
    voiceId: c.voiceId,
    modelId: c.modelId,
    order: c.order,
  };
}

export function toPodcastTurnDTO(t: TurnWithCharacter): PodcastTurnDTO {
  return {
    id: t.id,
    podcastId: t.podcastId,
    characterId: t.characterId,
    characterKey: t.character.key,
    characterName: t.character.name,
    order: t.order,
    text: t.text,
  };
}

export function toPodcastTakeDTO(take: PodcastTake): PodcastTakeDTO {
  const timeline = parseJsonColumn(
    take.timingJson,
    podcastTimelineSchema,
    [] as PodcastBeatTimingDTO[],
  );
  return {
    id: take.id,
    podcastId: take.podcastId,
    label: take.label,
    providerId: take.providerId,
    voiceId: take.voiceId,
    modelId: take.modelId,
    fps: take.fps,
    totalFrames: take.totalFrames,
    timeline,
    audioUrl: getAssetStore().url(take.audioPath),
    createdAt: take.createdAt.toISOString(),
  };
}

export { resolveLength, resolveGender };
