import { randomUUID } from "node:crypto";

import type { VoiceTakeDTO } from "@/lib/dto";
import {
  estimateSpeechSeconds,
  stitchBeats,
  type BeatInput,
} from "@/lib/audio-timing";
import { makeSilentWav, parseWav } from "@/lib/wav";
import { normalizeWavLoudness } from "@/lib/audio-normalize";
import { getProvider } from "@/providers/voice/registry";
import { ProviderError, type ProviderId } from "@/providers/voice/types";
import { prisma } from "@/library/db";
import { getAssetStore } from "@/library/storage";
import { createTake } from "@/library/repositories/takes";

export interface GenerateTakeInput {
  scriptId: string;
  /** When true, produce a silent placeholder take (no credits spent). */
  placeholder?: boolean;
  providerId?: ProviderId;
  voiceId?: string;
  modelId?: string;
  label?: string;
}

/**
 * Generate a voice take for a script: synthesize each scene as its own beat
 * (so its exact duration is known), stitch the beats into one track with gaps,
 * store the WAV, and persist the take with per-beat frame timing.
 */
export async function generateTake(
  input: GenerateTakeInput,
): Promise<VoiceTakeDTO> {
  const script = await prisma.script.findUnique({
    where: { id: input.scriptId },
    include: { scenes: { orderBy: { order: "asc" } } },
  });
  if (!script) throw new ProviderError("Script not found", 404);
  if (script.scenes.length === 0) {
    throw new ProviderError("Add at least one scene before generating a take", 400);
  }

  const fps = script.fps;
  const beats: BeatInput[] = [];
  let label = input.label;

  if (input.placeholder) {
    for (const scene of script.scenes) {
      beats.push({
        sceneId: scene.id,
        text: scene.text,
        wav: makeSilentWav(estimateSpeechSeconds(scene.text)),
      });
    }
    label = label ?? "Placeholder (silent)";
  } else {
    if (!input.providerId || !input.voiceId) {
      throw new ProviderError("Pick a provider and voice first", 400);
    }
    const provider = getProvider(input.providerId);
    if (provider.runtime === "client" || !provider.synth) {
      throw new ProviderError(
        `${provider.label} runs in your browser. Use "Generate in browser" in the editor instead.`,
        400,
        input.providerId,
      );
    }
    if (!provider.isConfigured()) {
      throw new ProviderError(
        `${provider.label} has no API key. Add one in Settings.`,
        400,
        input.providerId,
      );
    }

    const synth = provider.synth;

    // Sequential to stay friendly to provider rate limits.
    for (const scene of script.scenes) {
      const { wav } = await synth({
        voiceId: input.voiceId,
        modelId: input.modelId,
        text: scene.text,
      });
      beats.push({ sceneId: scene.id, text: scene.text, wav });
    }
    label = label ?? `${provider.label}${input.modelId ? ` · ${input.modelId}` : ""}`;
  }

  const stitched = stitchBeats(beats, fps);
  // Even out per-provider/voice level differences (no-op for silent placeholders).
  const wav = input.placeholder
    ? stitched.wav
    : normalizeWavLoudness(stitched.wav);

  const key = `takes/${randomUUID()}.wav`;
  await getAssetStore().put(key, wav);

  return createTake({
    scriptId: input.scriptId,
    label,
    providerId: input.placeholder ? "placeholder" : input.providerId!,
    voiceId: input.placeholder ? "silent" : input.voiceId!,
    modelId: input.modelId,
    fps,
    totalFrames: stitched.totalFrames,
    timeline: stitched.timeline,
    audioPath: key,
    isPlaceholder: Boolean(input.placeholder),
  });
}

export interface UploadedBeat {
  sceneId: string;
  /** 16-bit PCM WAV bytes generated in the browser (e.g. by Kokoro). */
  wav: Buffer;
}

export interface CreateTakeFromBeatsInput {
  scriptId: string;
  providerId: string;
  voiceId: string;
  modelId?: string;
  label?: string;
  beats: UploadedBeat[];
}

/**
 * Create a take from per-scene WAVs generated client-side (browser TTS).
 *
 * The server re-stitches the beats itself so timing is always trustworthy — the
 * client never supplies frame numbers. The resulting take is identical in shape
 * to a server-generated one (same storage key scheme, timeline and columns), so
 * selection, playback and rendering all work unchanged.
 */
export async function createTakeFromBeats(
  input: CreateTakeFromBeatsInput,
): Promise<VoiceTakeDTO> {
  const script = await prisma.script.findUnique({
    where: { id: input.scriptId },
    include: { scenes: { orderBy: { order: "asc" } } },
  });
  if (!script) throw new ProviderError("Script not found", 404);
  if (script.scenes.length === 0) {
    throw new ProviderError("Add at least one scene before generating a take", 400);
  }

  const byScene = new Map(input.beats.map((b) => [b.sceneId, b.wav]));
  const beats: BeatInput[] = [];
  for (const scene of script.scenes) {
    const wav = byScene.get(scene.id);
    if (!wav) {
      throw new ProviderError(
        "Audio is missing for one or more scenes — regenerate the voiceover.",
        400,
      );
    }
    // Reject corrupt or non-PCM uploads before they reach storage.
    parseWav(wav);
    beats.push({ sceneId: scene.id, text: scene.text, wav });
  }

  const stitched = stitchBeats(beats, script.fps);
  const key = `takes/${randomUUID()}.wav`;
  await getAssetStore().put(key, normalizeWavLoudness(stitched.wav));

  return createTake({
    scriptId: input.scriptId,
    label: input.label ?? input.providerId,
    providerId: input.providerId,
    voiceId: input.voiceId,
    modelId: input.modelId,
    fps: script.fps,
    totalFrames: stitched.totalFrames,
    timeline: stitched.timeline,
    audioPath: key,
    isPlaceholder: false,
  });
}
