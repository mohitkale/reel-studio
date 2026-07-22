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
import {
  ProviderError,
  type ProviderId,
  type SynthOptions,
  type SynthResult,
} from "@/providers/voice/types";
import { prisma } from "@/library/db";
import { getAssetStore } from "@/library/storage";
import { createTake } from "@/library/repositories/takes";
import {
  getCachedBeatWav,
  setCachedBeatWav,
  type SceneAudioCacheKey,
} from "@/library/scene-audio-cache";
import { resolveSpokenText } from "@/lib/spoken-text";

/** Reported as scenes finish synthesizing (cache hit or fresh call) or when stitching starts. */
export type TakeProgress =
  | { phase: "synthesizing"; scene: number; sceneCount: number; workingOn?: number }
  | { phase: "stitching"; scene: number; sceneCount: number };

export interface GenerateTakeInput {
  scriptId: string;
  /** When true, produce a silent placeholder take (no credits spent). */
  placeholder?: boolean;
  providerId?: ProviderId;
  voiceId?: string;
  modelId?: string;
  label?: string;
  onProgress?: (progress: TakeProgress) => void;
}

const DEFAULT_SYNTH_CONCURRENCY = 4;

/**
 * Synthesize every scene's audio with a bounded-concurrency worker pool
 * (instead of one-at-a-time), skipping the TTS API entirely for scenes whose
 * (text, voice, model) exactly matches a previously cached beat. Results are
 * returned in original scene order regardless of completion order.
 */
async function synthesizeScenesConcurrently(
  scenes: { id: string; text: string }[],
  ctx: { scriptId: string; providerId: string; voiceId: string; modelId?: string },
  synth: (opts: SynthOptions) => Promise<SynthResult>,
  maxConcurrency: number,
  onProgress?: (done: number, total: number, workingOn?: number) => void,
): Promise<BeatInput[]> {
  const total = scenes.length;
  const results: BeatInput[] = new Array(total);
  let cursor = 0;
  let completed = 0;

  async function worker() {
    while (cursor < scenes.length) {
      const i = cursor++;
      const scene = scenes[i];
      const cacheParts: SceneAudioCacheKey = {
        sceneId: scene.id,
        providerId: ctx.providerId,
        voiceId: ctx.voiceId,
        modelId: ctx.modelId,
        text: scene.text,
      };
      let wav = await getCachedBeatWav(cacheParts);
      if (!wav) {
        onProgress?.(completed, total, i + 1);
        const result = await synth({
          voiceId: ctx.voiceId,
          modelId: ctx.modelId,
          text: scene.text,
        });
        wav = result.wav;
        void setCachedBeatWav({ ...cacheParts, scriptId: ctx.scriptId }, wav);
      }
      results[i] = { sceneId: scene.id, text: scene.text, wav };
      completed += 1;
      onProgress?.(completed, total);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(maxConcurrency, scenes.length || 1) }, worker),
  );
  return results;
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
    input.onProgress?.({ phase: "synthesizing", scene: 0, sceneCount: script.scenes.length });
    for (const scene of script.scenes) {
      const spoken = resolveSpokenText(scene);
      beats.push({
        sceneId: scene.id,
        text: spoken,
        wav: makeSilentWav(estimateSpeechSeconds(spoken)),
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
        input.providerId === "voiceforge"
          ? `${provider.label} is not configured. Set VOICEFORGE_SERVICE_URL in .env.local (use http://127.0.0.1:8089, or host.docker.internal if Reel Studio runs in Docker).`
          : `${provider.label} has no API key. Add one in Settings.`,
        400,
        input.providerId,
      );
    }

    const sceneCount = script.scenes.length;
    input.onProgress?.({ phase: "synthesizing", scene: 0, sceneCount });
    const synthesized = await synthesizeScenesConcurrently(
      script.scenes.map((s) => ({ id: s.id, text: resolveSpokenText(s) })),
      {
        scriptId: input.scriptId,
        providerId: input.providerId,
        voiceId: input.voiceId,
        modelId: input.modelId,
      },
      provider.synth,
      provider.maxConcurrency ?? DEFAULT_SYNTH_CONCURRENCY,
      (done, total, workingOn) =>
        input.onProgress?.({
          phase: "synthesizing",
          scene: done,
          sceneCount: total,
          workingOn,
        }),
    );
    beats.push(...synthesized);
    label = label ?? `${provider.label}${input.modelId ? ` · ${input.modelId}` : ""}`;
  }

  input.onProgress?.({ phase: "stitching", scene: beats.length, sceneCount: beats.length });
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
    beats.push({ sceneId: scene.id, text: resolveSpokenText(scene), wav });
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
