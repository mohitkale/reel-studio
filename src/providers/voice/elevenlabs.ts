import { z } from "zod";

import {
  normalizeWavToTarget,
  parseWav,
  TARGET_SAMPLE_RATE,
} from "@/lib/wav";
import { providerFetch } from "./http";
import {
  ProviderError,
  type SynthOptions,
  type SynthResult,
  type VoiceModel,
  type VoiceProvider,
  type VoiceSummary,
} from "./types";

const API_BASE = "https://api.elevenlabs.io";
export const ELEVENLABS_DEFAULT_MODEL = "eleven_multilingual_v2";

/**
 * Prefer native 44.1 kHz WAV when the plan allows it (Pro+). Free/Starter reject
 * wav_44100 with HTTP 403 subscription_required — fall back to wav_24000 and
 * resample into the pipeline's 44.1 kHz target.
 */
const PREFERRED_OUTPUT_FORMAT = "wav_44100";
const FREE_TIER_OUTPUT_FORMAT = "wav_24000";

const elVoiceSchema = z.object({
  voice_id: z.string(),
  name: z.string().nullish(),
  category: z.string().nullish(),
  description: z.string().nullish(),
  preview_url: z.string().nullish(),
  labels: z.record(z.string(), z.string()).nullish(),
});

const elVoicesResponseSchema = z.object({
  voices: z.array(elVoiceSchema),
  has_more: z.boolean().nullish(),
  next_page_token: z.string().nullish(),
});

const elModelSchema = z.object({
  model_id: z.string(),
  name: z.string().nullish(),
  can_do_text_to_speech: z.boolean().nullish(),
});

type ElVoice = z.infer<typeof elVoiceSchema>;

// ElevenLabs category -> our normalized category.
function mapCategory(category?: string | null): VoiceSummary["category"] {
  switch (category) {
    case "cloned":
      return "cloned";
    case "professional":
      return "professional";
    case "famous":
      return "shared";
    default:
      // premade, generated, high_quality
      return "default";
  }
}

function mapVoice(v: ElVoice): VoiceSummary {
  const tags = v.labels ? Object.values(v.labels).filter(Boolean) : undefined;
  return {
    id: v.voice_id,
    name: v.name ?? v.voice_id,
    category: mapCategory(v.category),
    language: v.labels?.language ?? undefined,
    previewUrl: v.preview_url ?? undefined,
    tags: tags && tags.length ? tags : undefined,
  };
}

function isOutputFormatPlanError(err: unknown): boolean {
  if (!(err instanceof ProviderError)) return false;
  if (err.status !== 403 && err.status !== 401) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("output_format") ||
    msg.includes("subscription_required") ||
    msg.includes("output format") ||
    msg.includes("pro tier")
  );
}

export function createElevenLabsProvider(): VoiceProvider {
  const key = () => process.env.ELEVENLABS_API_KEY?.trim() || "";
  const headers = () => ({ "xi-api-key": key() });

  async function requestSpeech(
    opts: SynthOptions,
    outputFormat: string,
  ): Promise<Buffer> {
    const voiceSettings: Record<string, number> = {};
    if (opts.stability !== undefined) voiceSettings.stability = opts.stability;
    if (opts.similarity !== undefined)
      voiceSettings.similarity_boost = opts.similarity;

    const body = {
      text: opts.text,
      model_id: opts.modelId ?? ELEVENLABS_DEFAULT_MODEL,
      ...(Object.keys(voiceSettings).length
        ? { voice_settings: voiceSettings }
        : {}),
    };

    const res = await providerFetch(
      `${API_BASE}/v1/text-to-speech/${encodeURIComponent(opts.voiceId)}?output_format=${outputFormat}`,
      {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      "elevenlabs",
    );

    return Buffer.from(await res.arrayBuffer());
  }

  return {
    id: "elevenlabs",
    label: "ElevenLabs",
    runtime: "server",
    // Free plans allow 2 concurrent requests; keep headroom under that.
    maxConcurrency: 2,

    isConfigured: () => key().length > 0,

    async listModels() {
      const res = await providerFetch(
        `${API_BASE}/v1/models`,
        { method: "GET", headers: headers() },
        "elevenlabs",
      );
      const models = z.array(elModelSchema).parse(await res.json());
      return models
        .filter((m) => m.can_do_text_to_speech !== false)
        .map<VoiceModel>((m) => ({ id: m.model_id, label: m.name ?? m.model_id }));
    },

    async listVoices(query?: string) {
      const params = new URLSearchParams({ page_size: "100" });
      if (query) params.set("search", query);
      const res = await providerFetch(
        `${API_BASE}/v2/voices?${params.toString()}`,
        { method: "GET", headers: headers() },
        "elevenlabs",
      );
      const json = elVoicesResponseSchema.parse(await res.json());
      return json.voices.map(mapVoice);
    },

    async synth(opts: SynthOptions): Promise<SynthResult> {
      let wav: Buffer;
      try {
        wav = await requestSpeech(opts, PREFERRED_OUTPUT_FORMAT);
      } catch (err) {
        if (!isOutputFormatPlanError(err)) throw err;
        wav = await requestSpeech(opts, FREE_TIER_OUTPUT_FORMAT);
      }

      const target = opts.sampleRate ?? TARGET_SAMPLE_RATE;
      const normalized = normalizeWavToTarget(wav, target);
      const info = parseWav(normalized);
      return { wav: normalized, sampleRate: info.sampleRate };
    },
  };
}
