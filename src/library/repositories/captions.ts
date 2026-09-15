import type { CaptionCue, CaptionTimingSource } from "@/lib/captions";
import {
  captionStyleSnapshotSchema,
  LEGACY_CAPTION_STYLE,
  type CaptionStyleSnapshot,
} from "@/lib/caption-style";
import type { CaptionTrackDTO } from "@/lib/dto";
import { prisma } from "@/library/db";
import {
  captionTimingSourceSchema,
  captionWordsSchema,
  parseJsonColumn,
} from "@/library/schemas";
import { ProviderError } from "@/providers/voice/types";

type CaptionTrackRow = Awaited<
  ReturnType<typeof prisma.captionTrack.findFirst>
> & {
  cues?: Array<{
    id: string;
    order: number;
    startFrame: number;
    endFrame: number;
    text: string;
    wordsJson: string | null;
  }>;
};

function toCaptionTrackDTO(
  track: NonNullable<CaptionTrackRow>,
): CaptionTrackDTO {
  const timingSource = captionTimingSourceSchema.parse(track.timingSource);
  return {
    id: track.id,
    scriptId: track.scriptId,
    label: track.label,
    language: track.language,
    timingSource,
    enabled: track.enabled,
    style: parseJsonColumn(
      track.styleJson,
      captionStyleSnapshotSchema,
      LEGACY_CAPTION_STYLE,
    ),
    cues: (track.cues ?? []).map((cue) => ({
      id: cue.id,
      order: cue.order,
      startFrame: cue.startFrame,
      endFrame: cue.endFrame,
      text: cue.text,
      words: parseJsonColumn(cue.wordsJson, captionWordsSchema, []),
    })),
    updatedAt: track.updatedAt.toISOString(),
  };
}

export async function listCaptionTracks(
  scriptId: string,
): Promise<CaptionTrackDTO[]> {
  const tracks = await prisma.captionTrack.findMany({
    where: { scriptId },
    include: { cues: { orderBy: { order: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });
  return tracks.map((track) => toCaptionTrackDTO(track));
}

export async function replaceCaptionTrack(input: {
  scriptId: string;
  trackId?: string;
  label?: string;
  language?: string;
  timingSource: CaptionTimingSource;
  enabled?: boolean;
  style?: CaptionStyleSnapshot;
  cues: CaptionCue[];
}): Promise<CaptionTrackDTO> {
  const track = await prisma.$transaction(async (tx) => {
    let id = input.trackId;
    if (input.enabled) {
      await tx.captionTrack.updateMany({
        where: { scriptId: input.scriptId, ...(id ? { id: { not: id } } : {}) },
        data: { enabled: false },
      });
    }
    if (id) {
      const updated = await tx.captionTrack.updateMany({
        where: { id, scriptId: input.scriptId },
        data: {
          label: input.label,
          language: input.language,
          timingSource: input.timingSource,
          enabled: input.enabled,
          styleJson:
            input.style === undefined ? undefined : JSON.stringify(input.style),
        },
      });
      if (updated.count !== 1) {
        throw new ProviderError("Caption track not found", 404);
      }
      await tx.captionCue.deleteMany({ where: { trackId: id } });
    } else {
      const created = await tx.captionTrack.create({
        data: {
          scriptId: input.scriptId,
          label: input.label,
          language: input.language,
          timingSource: input.timingSource,
          enabled: input.enabled,
          styleJson: input.style ? JSON.stringify(input.style) : null,
        },
      });
      id = created.id;
    }
    if (input.cues.length) {
      await tx.captionCue.createMany({
        data: input.cues.map((cue, order) => ({
          trackId: id!,
          order,
          startFrame: cue.startFrame,
          endFrame: cue.endFrame,
          text: cue.text,
          wordsJson: cue.words?.length ? JSON.stringify(cue.words) : null,
        })),
      });
    }
    return tx.captionTrack.findUniqueOrThrow({
      where: { id },
      include: { cues: { orderBy: { order: "asc" } } },
    });
  });
  return toCaptionTrackDTO(track);
}

export async function updateCaptionTrackStyle(
  scriptId: string,
  trackId: string,
  style: CaptionStyleSnapshot,
): Promise<CaptionTrackDTO> {
  const parsed = captionStyleSnapshotSchema.parse(style);
  const result = await prisma.captionTrack.updateMany({
    where: { id: trackId, scriptId },
    data: { styleJson: JSON.stringify(parsed) },
  });
  if (result.count !== 1) {
    throw new ProviderError("Caption track not found", 404);
  }
  const track = await prisma.captionTrack.findUniqueOrThrow({
    where: { id: trackId },
    include: { cues: { orderBy: { order: "asc" } } },
  });
  return toCaptionTrackDTO(track);
}

export async function updateCaptionCue(
  scriptId: string,
  cueId: string,
  data: {
    text?: string;
    startFrame?: number;
    endFrame?: number;
    words?: CaptionCue["words"];
  },
): Promise<CaptionTrackDTO> {
  const cue = await prisma.captionCue.findFirst({
    where: { id: cueId, track: { scriptId } },
  });
  if (!cue) throw new ProviderError("Caption cue not found", 404);
  const startFrame = data.startFrame ?? cue.startFrame;
  const endFrame = data.endFrame ?? cue.endFrame;
  if (endFrame <= startFrame) {
    throw new ProviderError("Caption cue must end after it starts", 400);
  }
  const track = await prisma.$transaction(async (tx) => {
    await tx.captionCue.update({
      where: { id: cueId },
      data: {
        text: data.text,
        startFrame: data.startFrame,
        endFrame: data.endFrame,
        wordsJson:
          data.words === undefined
            ? undefined
            : data.words.length
              ? JSON.stringify(data.words)
              : null,
      },
    });
    await tx.captionTrack.update({
      where: { id: cue.trackId },
      data: { updatedAt: new Date() },
    });
    return tx.captionTrack.findUniqueOrThrow({
      where: { id: cue.trackId },
      include: { cues: { orderBy: { order: "asc" } } },
    });
  });
  return toCaptionTrackDTO(track);
}

export async function setCaptionTrackEnabled(
  scriptId: string,
  trackId: string,
  enabled: boolean,
): Promise<CaptionTrackDTO> {
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.captionTrack.updateMany({
      where: { id: trackId, scriptId },
      data: { enabled },
    });
    if (result.count === 1 && enabled) {
      await tx.captionTrack.updateMany({
        where: { scriptId, id: { not: trackId } },
        data: { enabled: false },
      });
    }
    return result;
  });
  if (updated.count !== 1) {
    throw new ProviderError("Caption track not found", 404);
  }
  const track = await prisma.captionTrack.findUniqueOrThrow({
    where: { id: trackId },
    include: { cues: { orderBy: { order: "asc" } } },
  });
  return toCaptionTrackDTO(track);
}

export async function getCaptionAudioSource(
  scriptId: string,
  takeId: string,
): Promise<{ audioPath: string }> {
  const take = await prisma.voiceTake.findFirst({
    where: { id: takeId, scriptId },
    select: { audioPath: true, isPlaceholder: true },
  });
  if (!take) throw new ProviderError("Voice take not found", 404);
  if (take.isPlaceholder) {
    throw new ProviderError(
      "Generate or upload a complete voice take before transcribing it",
      400,
    );
  }
  return { audioPath: take.audioPath };
}
