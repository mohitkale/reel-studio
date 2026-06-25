import { z } from "zod";

/**
 * Voice provider contract. The UI and API talk only to this interface, never to
 * a vendor SDK directly. Adding a new TTS vendor = implement this + register it.
 */

// Order here is the order shown in the editor's provider dropdown.
export const PROVIDER_IDS = [
  "kokoro",
  "kokoro-server",
  "webspeech",
  "cartesia",
  "elevenlabs",
] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

/**
 * Where synthesis runs. "server" providers call a vendor API and return WAV
 * bytes from synth(). "client" providers generate audio in the user's browser
 * (free, no VPS load, no install) and have no server-side synth() — their takes
 * are created via the upload endpoint instead.
 */
export type ProviderRuntime = "server" | "client";

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
  /** Where synthesis runs — see ProviderRuntime. */
  runtime: ProviderRuntime;
  /** Client providers that can only preview (e.g. Web Speech) and never persist a take. */
  preview?: boolean;
  /** Server provider that needs no API key (e.g. local Kokoro) — hidden from the key settings. */
  keyless?: boolean;
  /** True when an API key is present (server providers); always true for client/keyless providers. */
  isConfigured(): boolean;
  listModels(): Promise<VoiceModel[]>;
  /** Merges the vendor's default/library voices with the user's owned/cloned voices. */
  listVoices(query?: string): Promise<VoiceSummary[]>;
  /** Server-side synthesis. Omitted by client-runtime providers (browser-generated). */
  synth?(opts: SynthOptions): Promise<SynthResult>;
}

/** Provider metadata exposed to the UI (no secrets). */
export const providerStatusSchema = z.object({
  id: z.enum(PROVIDER_IDS),
  label: z.string(),
  configured: z.boolean(),
  defaultModel: z.string().optional(),
  runtime: z.enum(["server", "client"]),
  /** Preview-only client providers cannot produce a render-usable take. */
  preview: z.boolean().optional(),
  /** Server provider needing no API key (hidden from the key settings card). */
  keyless: z.boolean().optional(),
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
