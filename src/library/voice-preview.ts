import { createHash } from "node:crypto";

import { getProvider } from "@/providers/voice/registry";
import {
  ProviderError,
  type ProviderId,
} from "@/providers/voice/types";
import { getAssetStore } from "@/library/storage";

export const VOICE_PREVIEW_TEXT = "Hi, how are you doing today?";

function previewKey(
  providerId: string,
  voiceId: string,
  modelId: string | undefined,
  text: string,
): string {
  const hash = createHash("sha1")
    .update([providerId, voiceId, modelId ?? "", text].join("|"))
    .digest("hex")
    .slice(0, 24);
  return `voice-previews/${providerId}/${hash}.wav`;
}

/**
 * Return a reusable preview URL for a voice. Synths once and caches the WAV
 * in AssetStore so subsequent clicks are instant.
 */
export async function getOrCreateVoicePreview(input: {
  providerId: string;
  voiceId: string;
  modelId?: string;
  text?: string;
}): Promise<{ audioUrl: string; cached: boolean }> {
  const text = (input.text?.trim() || VOICE_PREVIEW_TEXT).slice(0, 200);
  const key = previewKey(
    input.providerId,
    input.voiceId,
    input.modelId,
    text,
  );
  const store = getAssetStore();

  if (await store.exists(key)) {
    return { audioUrl: store.url(key), cached: true };
  }

  const provider = getProvider(input.providerId as ProviderId);
  if (provider.runtime === "client" || !provider.synth) {
    throw new ProviderError(
      `${provider.label} runs in the browser — pick a server voice (e.g. Kokoro server) for preview.`,
      400,
      input.providerId as ProviderId,
    );
  }
  if (!provider.isConfigured()) {
    throw new ProviderError(
      `${provider.label} is not configured.`,
      400,
      input.providerId as ProviderId,
    );
  }

  const result = await provider.synth({
    voiceId: input.voiceId,
    modelId: input.modelId,
    text,
  });
  await store.put(key, result.wav);
  return { audioUrl: store.url(key), cached: false };
}
