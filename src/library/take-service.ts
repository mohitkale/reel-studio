import { randomUUID } from "node:crypto";

import type { VoiceTakeDTO } from "@/lib/dto";
import {
  estimateSpeechSeconds,
  stitchBeats,
  type BeatInput,
} from "@/lib/audio-timing";
import { makeSilentWav } from "@/lib/wav";
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
    if (!provider.isConfigured()) {
      throw new ProviderError(
        `${provider.label} has no API key. Add one in Settings.`,
        400,
        input.providerId,
      );
    }

    // Sequential to stay friendly to provider rate limits.
    for (const scene of script.scenes) {
      const { wav } = await provider.synth({
        voiceId: input.voiceId,
        modelId: input.modelId,
        text: scene.text,
      });
      beats.push({ sceneId: scene.id, text: scene.text, wav });
    }
    label = label ?? `${provider.label}${input.modelId ? ` · ${input.modelId}` : ""}`;
  }

  const stitched = stitchBeats(beats, fps);

  const key = `takes/${randomUUID()}.wav`;
  await getAssetStore().put(key, stitched.wav);

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
