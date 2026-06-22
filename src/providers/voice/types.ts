import { z } from "zod";

/**
 * Voice provider contract. The UI and API talk only to this interface, never to
 * a vendor SDK directly. Adding a new TTS vendor = implement this + register it.
 */

export const PROVIDER_IDS = ["cartesia", "elevenlabs"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const voiceCategorySchema = z.enum([
  "default",
  "cloned",
  "professional",
  "shared",
]);
export type VoiceCategory = z.infer<typeof voiceCategorySchema>;

export const voiceSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  category: voiceCategorySchema,
  language: z.string().optional(),
  /** Plays a sample without spending credits. */
  previewUrl: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
});
export type VoiceSummary = z.infer<typeof voiceSummarySchema>;

export const voiceModelSchema = z.object({
  id: z.string(),
  label: z.string(),
});
export type VoiceModel = z.infer<typeof voiceModelSchema>;

export const synthOptionsSchema = z.object({
  voiceId: z.string().min(1),
  modelId: z.string().optional(),
  text: z.string().min(1),
  sampleRate: z.number().int().positive().optional(),
  // Optional expressive controls, applied where the vendor supports them.
  speed: z.number().optional(),
  emotion: z.string().optional(),
  stability: z.number().min(0).max(1).optional(),
  similarity: z.number().min(0).max(1).optional(),
  language: z.string().optional(),
});
export type SynthOptions = z.infer<typeof synthOptionsSchema>;

export interface SynthResult {
  /** 16-bit PCM WAV bytes, normalized to the target sample rate. */
  wav: Buffer;
  sampleRate: number;
}

export interface VoiceProvider {
  id: ProviderId;
  label: string;
  /** True when an API key is present in the environment. */
  isConfigured(): boolean;
  listModels(): Promise<VoiceModel[]>;
  /** Merges the vendor's default/library voices with the user's owned/cloned voices. */
  listVoices(query?: string): Promise<VoiceSummary[]>;
  synth(opts: SynthOptions): Promise<SynthResult>;
}

/** Provider metadata exposed to the UI (no secrets). */
export const providerStatusSchema = z.object({
  id: z.enum(PROVIDER_IDS),
  label: z.string(),
  configured: z.boolean(),
  defaultModel: z.string().optional(),
});
export type ProviderStatus = z.infer<typeof providerStatusSchema>;

/** A typed error the API surfaces with an actionable message and HTTP-ish status. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status = 502,
    readonly providerId?: ProviderId,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
