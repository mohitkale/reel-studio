import type {
  PodcastDTO,
  PodcastGenderDTO,
  PodcastLengthDTO,
  PodcastSummaryDTO,
  PodcastTakeDTO,
} from "@/lib/dto";
import type { PodcastBeatTiming } from "@/library/podcast-schemas";
import type { PodcastPlan } from "@/library/podcast-schemas";
import { prisma } from "@/library/db";
import { getAssetStore } from "@/library/storage";
import {
  resolveLength,
  toPodcastCharacterDTO,
  toPodcastTakeDTO,
  toPodcastTurnDTO,
} from "./podcast-map";

const DEFAULT_CAST: {
  key: string;
  name: string;
  gender: PodcastGenderDTO;
  definition: string;
}[] = [
  {
    key: "maya",
    name: "Maya",
    gender: "female",
    definition:
      "Warm primary host. Curious, clear, invites guests in by name, keeps the episode moving.",
  },
  {
    key: "jordan",
    name: "Jordan",
    gender: "male",
    definition:
      "Thoughtful co-host/guest. Practical examples, grounded reactions, friendly pushback.",
  },
];

function slugKey(name: string, fallback: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  return base || fallback;
}

async function loadPodcast(id: string): Promise<PodcastDTO | null> {
  const podcast = await prisma.podcast.findUnique({
    where: { id },
    include: {
      characters: { orderBy: { order: "asc" } },
      turns: {
        orderBy: { order: "asc" },
        include: { character: true },
      },
      takes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!podcast) return null;
  return {
    id: podcast.id,
    title: podcast.title,
    description: podcast.description,
    length: resolveLength(podcast.length),
    characters: podcast.characters.map(toPodcastCharacterDTO),
    turns: podcast.turns.map(toPodcastTurnDTO),
    takes: podcast.takes.map(toPodcastTakeDTO),
    createdAt: podcast.createdAt.toISOString(),
    updatedAt: podcast.updatedAt.toISOString(),
  };
}

export async function listPodcasts(): Promise<PodcastSummaryDTO[]> {
  const rows = await prisma.podcast.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { characters: true, turns: true, takes: true } },
    },
  });
  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    length: resolveLength(p.length),
    characterCount: p._count.characters,
    turnCount: p._count.turns,
    takeCount: p._count.takes,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));
}

export async function getPodcast(id: string): Promise<PodcastDTO | null> {
  return loadPodcast(id);
}

export async function createPodcast(input?: {
  title?: string;
  description?: string;
  length?: PodcastLengthDTO;
}): Promise<PodcastDTO> {
  const title = input?.title?.trim() || "Untitled podcast";
  const description = input?.description?.trim() || "";
  const length = input?.length ?? "short";

  const created = await prisma.podcast.create({
    data: {
      title,
      description,
      length,
      characters: {
        create: DEFAULT_CAST.map((c, order) => ({
          key: c.key,
          name: c.name,
          gender: c.gender,
          definition: c.definition,
          order,
        })),
      },
    },
  });
  const full = await loadPodcast(created.id);
  if (!full) throw new Error("Failed to load created podcast");
  return full;
}

export async function updatePodcastMeta(
  id: string,
  patch: {
    title?: string;
    description?: string;
    length?: PodcastLengthDTO;
  },
): Promise<PodcastDTO> {
  await prisma.podcast.update({
    where: { id },
    data: {
      ...(patch.title != null ? { title: patch.title.trim() } : {}),
      ...(patch.description != null
        ? { description: patch.description.trim() }
        : {}),
      ...(patch.length != null ? { length: patch.length } : {}),
    },
  });
  const full = await loadPodcast(id);
  if (!full) throw new Error("Podcast not found");
  return full;
}

export async function deletePodcast(id: string): Promise<void> {
  const takes = await prisma.podcastTake.findMany({ where: { podcastId: id } });
  await prisma.podcast.delete({ where: { id } });
  await Promise.all(
    takes.map((t) => getAssetStore().delete(t.audioPath).catch(() => undefined)),
  );
}

export interface CharacterInput {
  id?: string;
  key?: string;
  name: string;
  gender: PodcastGenderDTO;
  definition?: string;
  providerId?: string;
  voiceId?: string;
  modelId?: string | null;
}

/** Replace the cast (2–4 characters). Clears turns that reference removed characters. */
export async function replaceCharacters(
  podcastId: string,
  characters: CharacterInput[],
): Promise<PodcastDTO> {
  if (characters.length < 2 || characters.length > 4) {
    throw new Error("Podcasts need between 2 and 4 characters");
  }

  const keys: string[] = [];
  const normalized = characters.map((c, order) => {
    let key = (c.key?.trim() || slugKey(c.name, `speaker-${order + 1}`)).toLowerCase();
    if (keys.includes(key)) key = `${key}-${order + 1}`;
    keys.push(key);
    return {
      key,
      name: c.name.trim(),
      gender: c.gender,
      definition: (c.definition ?? "").trim().slice(0, 1000),
      providerId: c.providerId?.trim() || "",
      voiceId: c.voiceId?.trim() || "",
      modelId: c.modelId?.trim() || null,
      order,
    };
  });

  await prisma.$transaction(async (tx) => {
    await tx.podcastTurn.deleteMany({ where: { podcastId } });
    await tx.podcastCharacter.deleteMany({ where: { podcastId } });
    await tx.podcastCharacter.createMany({
      data: normalized.map((c) => ({ ...c, podcastId })),
    });
    await tx.podcast.update({
      where: { id: podcastId },
      data: { updatedAt: new Date() },
    });
  });

  const full = await loadPodcast(podcastId);
  if (!full) throw new Error("Podcast not found");
  return full;
}

/** Update voice bindings without wiping the script. */
export async function updateCharacterVoices(
  podcastId: string,
  updates: {
    id: string;
    providerId?: string;
    voiceId?: string;
    modelId?: string | null;
    name?: string;
    gender?: PodcastGenderDTO;
    definition?: string;
  }[],
): Promise<PodcastDTO> {
  await prisma.$transaction(
    updates.map((u) =>
      prisma.podcastCharacter.update({
        where: { id: u.id },
        data: {
          ...(u.providerId != null ? { providerId: u.providerId } : {}),
          ...(u.voiceId != null ? { voiceId: u.voiceId } : {}),
          ...(u.modelId !== undefined ? { modelId: u.modelId } : {}),
          ...(u.name != null ? { name: u.name.trim() } : {}),
          ...(u.gender != null ? { gender: u.gender } : {}),
          ...(u.definition != null
            ? { definition: u.definition.trim().slice(0, 1000) }
            : {}),
        },
      }),
    ),
  );
  await prisma.podcast.update({
    where: { id: podcastId },
    data: { updatedAt: new Date() },
  });
  const full = await loadPodcast(podcastId);
  if (!full) throw new Error("Podcast not found");
  return full;
}

export async function replaceTurnsFromPlan(
  podcastId: string,
  plan: PodcastPlan,
  opts?: { updateMeta?: boolean },
): Promise<PodcastDTO> {
  const podcast = await prisma.podcast.findUnique({
    where: { id: podcastId },
    include: { characters: true },
  });
  if (!podcast) throw new Error("Podcast not found");

  const byKey = new Map(podcast.characters.map((c) => [c.key, c]));
  for (const turn of plan.turns) {
    if (!byKey.has(turn.characterId)) {
      throw new Error(
        `Unknown characterId "${turn.characterId}". Configure characters in Setup first (expected: ${[...byKey.keys()].join(", ")}).`,
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.podcastTurn.deleteMany({ where: { podcastId } });
    await tx.podcastTurn.createMany({
      data: plan.turns.map((t, order) => ({
        podcastId,
        characterId: byKey.get(t.characterId)!.id,
        order,
        text: t.text,
      })),
    });
    if (opts?.updateMeta) {
      await tx.podcast.update({
        where: { id: podcastId },
        data: {
          ...(plan.title ? { title: plan.title } : {}),
          ...(plan.description != null
            ? { description: plan.description }
            : {}),
          updatedAt: new Date(),
        },
      });
    } else {
      await tx.podcast.update({
        where: { id: podcastId },
        data: { updatedAt: new Date() },
      });
    }
  });

  const full = await loadPodcast(podcastId);
  if (!full) throw new Error("Podcast not found");
  return full;
}

export async function updateTurnText(
  turnId: string,
  text: string,
): Promise<PodcastDTO> {
  const turn = await prisma.podcastTurn.update({
    where: { id: turnId },
    data: { text: text.trim() },
  });
  await prisma.podcast.update({
    where: { id: turn.podcastId },
    data: { updatedAt: new Date() },
  });
  const full = await loadPodcast(turn.podcastId);
  if (!full) throw new Error("Podcast not found");
  return full;
}

/** Insert a dialogue turn after `afterTurnId` (or append when omitted). */
export async function insertTurn(
  podcastId: string,
  input: {
    characterId: string;
    text: string;
    afterTurnId?: string | null;
  },
): Promise<PodcastDTO> {
  const podcast = await prisma.podcast.findUnique({
    where: { id: podcastId },
    include: {
      characters: true,
      turns: { orderBy: { order: "asc" } },
    },
  });
  if (!podcast) throw new Error("Podcast not found");

  const character = podcast.characters.find((c) => c.id === input.characterId);
  if (!character) throw new Error("Character not found on this podcast");

  const text = input.text.trim();
  if (!text) throw new Error("Dialogue text is required");

  let insertAt = podcast.turns.length;
  if (input.afterTurnId) {
    const idx = podcast.turns.findIndex((t) => t.id === input.afterTurnId);
    if (idx < 0) throw new Error("Anchor turn not found");
    insertAt = idx + 1;
  }

  await prisma.$transaction(async (tx) => {
    // Shift orders for turns at/after insert point (high → low to avoid unique collisions).
    const toShift = podcast.turns.filter((t) => t.order >= insertAt);
    for (let i = toShift.length - 1; i >= 0; i--) {
      const t = toShift[i];
      await tx.podcastTurn.update({
        where: { id: t.id },
        data: { order: t.order + 1 },
      });
    }
    await tx.podcastTurn.create({
      data: {
        podcastId,
        characterId: character.id,
        order: insertAt,
        text,
      },
    });
    await tx.podcast.update({
      where: { id: podcastId },
      data: { updatedAt: new Date() },
    });
  });

  const full = await loadPodcast(podcastId);
  if (!full) throw new Error("Podcast not found");
  return full;
}

export async function deleteTurn(turnId: string): Promise<PodcastDTO> {
  const turn = await prisma.podcastTurn.findUnique({ where: { id: turnId } });
  if (!turn) throw new Error("Turn not found");
  const podcastId = turn.podcastId;
  await prisma.$transaction(async (tx) => {
    await tx.podcastTurn.delete({ where: { id: turnId } });
    const remaining = await tx.podcastTurn.findMany({
      where: { podcastId },
      orderBy: { order: "asc" },
    });
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].order !== i) {
        await tx.podcastTurn.update({
          where: { id: remaining[i].id },
          data: { order: i },
        });
      }
    }
    await tx.podcast.update({
      where: { id: podcastId },
      data: { updatedAt: new Date() },
    });
  });
  const full = await loadPodcast(podcastId);
  if (!full) throw new Error("Podcast not found");
  return full;
}

export interface CreatePodcastTakeInput {
  podcastId: string;
  label?: string;
  providerId: string;
  voiceId: string;
  modelId?: string;
  fps: number;
  totalFrames: number;
  timeline: PodcastBeatTiming[];
  voices: Array<{
    key: string;
    name: string;
    providerId: string;
    voiceId: string;
    modelId?: string | null;
  }>;
  audioPath: string;
}

export async function createPodcastTake(
  input: CreatePodcastTakeInput,
): Promise<PodcastTakeDTO> {
  const take = await prisma.podcastTake.create({
    data: {
      podcastId: input.podcastId,
      label: input.label,
      providerId: input.providerId,
      voiceId: input.voiceId,
      modelId: input.modelId,
      fps: input.fps,
      totalFrames: input.totalFrames,
      timingJson: JSON.stringify(input.timeline),
      voicesJson: JSON.stringify(input.voices),
      audioPath: input.audioPath,
    },
  });
  await prisma.podcast.update({
    where: { id: input.podcastId },
    data: { updatedAt: new Date() },
  });
  return toPodcastTakeDTO(take);
}

export async function listPodcastTakes(
  podcastId: string,
): Promise<PodcastTakeDTO[]> {
  const takes = await prisma.podcastTake.findMany({
    where: { podcastId },
    orderBy: { createdAt: "desc" },
  });
  return takes.map(toPodcastTakeDTO);
}

export async function deletePodcastTake(id: string): Promise<void> {
  const take = await prisma.podcastTake.findUnique({ where: { id } });
  if (!take) return;
  await prisma.podcastTake.delete({ where: { id } });
  await getAssetStore().delete(take.audioPath);
}
