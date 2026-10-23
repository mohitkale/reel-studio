import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/library/db";
import { getAssetStore } from "@/library/storage";
import {
  getPodcastTake,
  createPodcastTake,
} from "@/library/repositories/podcasts";
import { transcribeWithWhisperCpp } from "@/library/local-transcription";
import {
  productionSignal,
  assertProductionActive,
} from "@/library/production-cancellation";
import { ProviderError } from "@/providers/voice/types";
const execute = promisify(execFile);
export const reviewedCueSchema = z.object({
  turnId: z.string().min(1).max(200),
  text: z.string().trim().min(1).max(4000),
  characterKey: z.string().trim().min(1).max(80),
  startFrame: z.number().int().nonnegative(),
  durationFrames: z.number().int().positive(),
});
export const reviewedTranscriptSchema = z
  .array(reviewedCueSchema)
  .min(1)
  .max(2000);
export async function saveReviewedPodcastTranscript(
  takeId: string,
  raw: z.input<typeof reviewedTranscriptSchema>,
  label = "Reviewed transcript",
) {
  const cues = reviewedTranscriptSchema.parse(raw),
    row = await prisma.podcastTake.findUnique({ where: { id: takeId } }),
    take = await getPodcastTake(takeId);
  if (!row || !take) throw new ProviderError("Take not found", 404);
  if (
    new Set(cues.map((c) => c.turnId)).size !== cues.length ||
    cues.some(
      (cue, index) =>
        cue.startFrame + cue.durationFrames > take.totalFrames ||
        (index > 0 &&
          cue.startFrame <
            cues[index - 1].startFrame + cues[index - 1].durationFrames),
    )
  )
    throw new ProviderError(
      "Transcript passages must be ordered, non-overlapping and within this take",
      400,
    );
  assertProductionActive();
  return createPodcastTake({
    podcastId: row.podcastId,
    label,
    providerId: row.providerId,
    voiceId: row.voiceId,
    modelId: row.modelId ?? undefined,
    fps: take.fps,
    totalFrames: take.totalFrames,
    audioPath: row.audioPath,
    mp3Path: row.mp3Path ?? undefined,
    timeline: cues,
    chapters: [],
    voices: take.voices,
    finishing: take.finishing ?? {
      version: 1,
      intro: null,
      outro: null,
      pronunciations: [],
      pauses: [],
    },
  });
}
export async function transcribePodcastRecording(
  takeId: string,
  language = "auto",
) {
  if (!/^(auto|[a-z]{2,3})$/.test(language))
    throw new ProviderError("Choose auto or a supported language code", 400);
  const row = await prisma.podcastTake.findUnique({ where: { id: takeId } });
  if (!row) throw new ProviderError("Take not found", 404);
  const asset = await getAssetStore().open(row.audioPath);
  if (asset.size > 128 * 1024 * 1024) {
    await asset.close();
    throw new ProviderError("Transcription supports up to 128 MiB", 413);
  }
  const audio = Buffer.from(await new Response(asset.stream()).arrayBuffer()),
    directory = await fs.mkdtemp(path.join(os.tmpdir(), "studio-transcribe-"));
  try {
    const input = path.join(directory, "input.wav"),
      output = path.join(directory, "speech.wav");
    await fs.writeFile(input, audio);
    await execute(
      "ffmpeg",
      [
        "-v",
        "error",
        "-nostdin",
        "-i",
        input,
        "-ar",
        "16000",
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        output,
      ],
      { signal: productionSignal(), timeout: 120000 },
    );
    const cues = await transcribeWithWhisperCpp({
      audio: await fs.readFile(output),
      fps: row.fps,
      language,
    });
    const passages = cues
      .filter((cue) => cue.startFrame < row.totalFrames)
      .map((cue) => ({
        turnId: randomUUID(),
        characterKey: "Recording",
        text: cue.text.trim(),
        startFrame: cue.startFrame,
        durationFrames: Math.max(
          1,
          Math.min(row.totalFrames, cue.endFrame) - cue.startFrame,
        ),
      }));
    return await saveReviewedPodcastTranscript(
      takeId,
      passages,
      "Local transcript — review before publishing",
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}
