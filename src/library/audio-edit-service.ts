import {
  productionSignal,
  assertProductionActive,
} from "@/library/production-cancellation";
import type { PrismaClient } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { z } from "zod";
import { prisma } from "@/library/db";
import { getAssetStore } from "@/library/storage";
import { getPodcast, getPodcastTake } from "@/library/repositories/podcasts";
import { parseWav, pcmToWav } from "@/lib/wav";
import {
  audioEditPlanSchema,
  rebaseAudioSegments,
  type AudioSegment,
  type AudioEditPlan,
} from "@/lib/audio-edit-plan";
import { timelineSchema, parseJsonColumn } from "@/library/schemas";
import { ProviderError } from "@/providers/voice/types";
const execute = promisify(execFile);
export const audioEditKindSchema = z.enum(["voiceover", "podcast"]);
export const audioHistorySchema = z.array(audioEditPlanSchema).min(1).max(50);
export const saveAudioEditSchema = z
  .object({
    kind: audioEditKindSchema,
    takeId: z.string().min(1).max(200),
    history: audioHistorySchema,
    cursor: z.number().int().min(0).max(49),
    expectedRevision: z.number().int().nonnegative(),
  })
  .refine(
    (input) => input.cursor < input.history.length,
    "Invalid history cursor",
  );
type Kind = z.infer<typeof audioEditKindSchema>;
function digest(plan: AudioEditPlan) {
  return createHash("sha256").update(JSON.stringify(plan)).digest("hex");
}
async function sourceTake(
  kind: Kind,
  id: string,
  client: PrismaClient = prisma,
) {
  if (kind === "voiceover") {
    const row = await client.voiceTake.findUnique({ where: { id } });
    if (!row) throw new ProviderError("Source take not found", 404);
    const timeline = parseJsonColumn(row.timingJson, timelineSchema, []);
    return {
      row,
      segments: timeline.map((beat) => ({
        id: beat.sceneId,
        text: beat.text,
        start: beat.startFrame / row.fps,
        end: (beat.startFrame + beat.durationFrames) / row.fps,
        speaker: "Narrator",
      })),
      timeline,
    };
  }
  const row = await client.podcastTake.findUnique({ where: { id } }),
    take = await getPodcastTake(id);
  if (!row || !take) throw new ProviderError("Source take not found", 404);
  const podcast = await getPodcast(row.podcastId);
  if (!podcast) throw new ProviderError("Episode not found", 404);
  return {
    row,
    segments: take.timeline.map((beat) => ({
      id: beat.turnId,
      text: beat.text,
      start: beat.startFrame / row.fps,
      end: (beat.startFrame + beat.durationFrames) / row.fps,
      speaker: beat.characterKey ?? "Speaker",
    })),
    timeline: take.timeline,
  };
}
export async function getAudioEdit(
  kind: Kind,
  takeId: string,
  client: PrismaClient = prisma,
) {
  await sourceTake(kind, takeId, client);
  const row = await client.audioEditSession.findUnique({
    where: { kind_takeId: { kind, takeId } },
  });
  return row
    ? {
        revision: row.revision,
        history: audioHistorySchema.parse(JSON.parse(row.historyJson)),
        cursor: row.cursor,
        derivedTakeId: row.derivedTakeId,
      }
    : null;
}
async function readAudio(key: string) {
  const asset = await getAssetStore().open(key);
  if (asset.size > 128 * 1024 * 1024) {
    await asset.close();
    throw new ProviderError("Audio editing supports up to 128 MiB", 413);
  }
  return Buffer.from(await new Response(asset.stream()).arrayBuffer());
}
function validatePlan(plan: AudioEditPlan, duration: number) {
  if (
    duration > 1800 ||
    plan.ranges.some((range) => range.end > duration + 0.000001)
  )
    throw new ProviderError("Edit ranges exceed the source audio", 400);
}
export async function saveAudioEdit(
  raw: z.input<typeof saveAudioEditSchema>,
  client: PrismaClient = prisma,
) {
  const input = saveAudioEditSchema.parse(raw),
    source = await sourceTake(input.kind, input.takeId, client),
    bytes = await readAudio(source.row.audioPath),
    duration = parseWav(bytes).durationSeconds;
  input.history.forEach((plan) => validatePlan(plan, duration));
  return client.$transaction(async (tx) => {
    const where = { kind_takeId: { kind: input.kind, takeId: input.takeId } },
      current = await tx.audioEditSession.findUnique({ where });
    if ((current?.revision ?? 0) !== input.expectedRevision)
      throw new ProviderError(
        "Audio edits changed in another session. Reload the saved plan before saving.",
        409,
      );
    const historyJson = JSON.stringify(input.history),
      planHash = digest(input.history[input.cursor]);
    if (
      current &&
      current.historyJson === historyJson &&
      current.cursor === input.cursor
    )
      return { revision: current.revision };
    const data = {
      historyJson,
      cursor: input.cursor,
      planHash,
      derivedTakeId:
        current?.planHash === planHash ? current.derivedTakeId : null,
    };
    const row = current
      ? await tx.audioEditSession.update({
          where,
          data: { ...data, revision: { increment: 1 } },
        })
      : await tx.audioEditSession.create({
          data: { kind: input.kind, takeId: input.takeId, ...data },
        });
    return { revision: row.revision };
  });
}
/** Sample-accurate cuts and speaker gain, with short fades at retained edges. */
export function editPcmAudio(
  bytes: Buffer,
  raw: AudioEditPlan,
  segments: AudioSegment[],
) {
  const plan = audioEditPlanSchema.parse(raw),
    info = parseWav(bytes);
  validatePlan(plan, info.durationSeconds);
  if (info.bitsPerSample !== 16)
    throw new ProviderError("Audio editing requires 16-bit PCM", 400);
  const frameBytes = info.channels * 2,
    chunks: Buffer[] = [];
  for (const range of plan.ranges) {
    const first = Math.round(range.start * info.sampleRate),
      last = Math.min(
        Math.floor(info.dataLength / frameBytes),
        Math.round(range.end * info.sampleRate),
      );
    const chunk = Buffer.from(
      bytes.subarray(
        info.dataOffset + first * frameBytes,
        info.dataOffset + last * frameBytes,
      ),
    );
    for (const segment of segments) {
      const from = Math.max(first, Math.round(segment.start * info.sampleRate)),
        to = Math.min(last, Math.round(segment.end * info.sampleRate));
      const gain = plan.gains[segment.speaker] ?? 1;
      if (gain === 1) continue;
      for (let frame = from; frame < to; frame++)
        for (let channel = 0; channel < info.channels; channel++) {
          const offset = (frame - first) * frameBytes + channel * 2;
          chunk.writeInt16LE(
            Math.max(
              -32768,
              Math.min(32767, Math.round(chunk.readInt16LE(offset) * gain)),
            ),
            offset,
          );
        }
    }
    const frames = chunk.length / frameBytes,
      fade = Math.min(
        Math.floor(info.sampleRate * 0.005),
        Math.floor(frames / 2),
      );
    for (let index = 0; index < fade; index++)
      for (let channel = 0; channel < info.channels; channel++)
        for (const frame of [index, frames - 1 - index]) {
          const offset = frame * frameBytes + channel * 2;
          chunk.writeInt16LE(
            Math.round((chunk.readInt16LE(offset) * index) / fade),
            offset,
          );
        }
    chunks.push(chunk);
  }
  return pcmToWav(Buffer.concat(chunks), {
    sampleRate: info.sampleRate,
    channels: info.channels,
    bitsPerSample: 16,
  });
}
export async function commitAudioEdit(
  kind: Kind,
  takeId: string,
  revision: number,
  client: PrismaClient = prisma,
) {
  const session = await client.audioEditSession.findUnique({
    where: { kind_takeId: { kind, takeId } },
  });
  if (!session || session.revision !== revision)
    throw new ProviderError("Save the current edit plan first", 409);
  if (session.derivedTakeId) {
    const existing =
      kind === "voiceover"
        ? await client.voiceTake.findUnique({
            where: { id: session.derivedTakeId },
          })
        : await client.podcastTake.findUnique({
            where: { id: session.derivedTakeId },
          });
    if (existing) return { takeId: existing.id };
  }
  const source = await sourceTake(kind, takeId, client),
    plan = audioHistorySchema.parse(JSON.parse(session.historyJson))[
      session.cursor
    ];
  let wav = editPcmAudio(
    await readAudio(source.row.audioPath),
    plan,
    source.segments,
  );
  if (plan.cleanup) {
    const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), "studio-audio-edit-"),
    );
    try {
      const input = path.join(directory, "input.wav"),
        output = path.join(directory, "output.wav");
      await fs.writeFile(input, wav);
      await execute(
        "ffmpeg",
        [
          "-v",
          "error",
          "-nostdin",
          "-i",
          input,
          "-af",
          "highpass=f=80,acompressor=threshold=0.126:ratio=3",
          "-c:a",
          "pcm_s16le",
          output,
        ],
        { timeout: 120000, signal: productionSignal() },
      );
      wav = await fs.readFile(output);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  }
  const fps = source.row.fps,
    totalFrames = Math.round(parseWav(wav).durationSeconds * fps),
    rebased = rebaseAudioSegments(source.segments, plan.ranges);
  const merged: typeof rebased = [];
  for (const segment of rebased) {
    const prior = merged.at(-1);
    if (prior?.id === segment.id) {
      prior.end = segment.end;
      prior.textNeedsReview = prior.textNeedsReview || segment.textNeedsReview;
    } else merged.push({ ...segment });
  }
  if (totalFrames < 1)
    throw new ProviderError("Keep at least one frame of audio", 400);
  const timeline = merged.map((segment) => ({
    ...(kind === "voiceover"
      ? { sceneId: segment.id }
      : {
          turnId: segment.id,
          characterKey:
            source.segments.find((beat) => beat.id === segment.id)?.speaker ??
            "Speaker",
        }),
    text: segment.text,
    startFrame: Math.min(totalFrames - 1, Math.round(segment.start * fps)),
    durationFrames: Math.max(
      1,
      Math.min(totalFrames, Math.round(segment.end * fps)) -
        Math.min(totalFrames - 1, Math.round(segment.start * fps)),
    ),
  }));
  if (kind === "voiceover" && !timeline.length)
    throw new ProviderError(
      "Keep narration from at least one paragraph to save a video take",
      400,
    );
  assertProductionActive();
  const key = `audio-edits/${randomUUID()}.wav`;
  await getAssetStore().put(key, wav);
  try {
    return await client.$transaction(async (tx) => {
      assertProductionActive();
      const sourceExists =
        kind === "voiceover"
          ? await tx.voiceTake.findUnique({
              where: { id: takeId },
              select: { id: true },
            })
          : await tx.podcastTake.findUnique({
              where: { id: takeId },
              select: { id: true },
            });
      if (!sourceExists)
        throw new ProviderError("Source take was deleted while saving", 409);
      const current = await tx.audioEditSession.findUniqueOrThrow({
        where: { id: session.id },
      });
      if (current.revision !== revision)
        throw new ProviderError(
          "Audio edits changed while saving the take",
          409,
        );
      const derived = current.derivedTakeId
        ? kind === "voiceover"
          ? await tx.voiceTake.findUnique({
              where: { id: current.derivedTakeId },
            })
          : await tx.podcastTake.findUnique({
              where: { id: current.derivedTakeId },
            })
        : null;
      if (derived)
        throw new ProviderError(
          "This edit was already saved. Reload to use the saved take.",
          409,
        );
      const label = `Edited · ${source.row.label ?? "Saved take"}`;
      const saved =
        kind === "voiceover" && "scriptId" in source.row
          ? await tx.voiceTake.create({
              data: {
                scriptId: source.row.scriptId,
                label,
                providerId: "audio-edit",
                voiceId: source.row.voiceId,
                modelId: source.row.modelId,
                fps,
                totalFrames,
                timingJson: JSON.stringify(timeline),
                audioPath: key,
                source: "edited",
                isPlaceholder: source.row.isPlaceholder,
              },
            })
          : kind === "podcast" && "podcastId" in source.row
            ? await tx.podcastTake.create({
                data: {
                  podcastId: source.row.podcastId,
                  label,
                  providerId: "audio-edit",
                  voiceId: source.row.voiceId,
                  modelId: source.row.modelId,
                  fps,
                  totalFrames,
                  timingJson: JSON.stringify(timeline),
                  chaptersJson: "[]",
                  voicesJson: source.row.voicesJson,
                  finishingJson: source.row.finishingJson,
                  audioPath: key,
                },
              })
            : null;
      if (!saved) throw new ProviderError("Invalid source type", 400);
      await tx.audioEditSession.update({
        where: { id: session.id },
        data: { derivedTakeId: saved.id },
      });
      return { takeId: saved.id };
    });
  } catch (error) {
    await getAssetStore()
      .delete(key)
      .catch(() => undefined);
    throw error;
  }
}
