import { z } from "zod";

import { parseWav } from "@/lib/wav";
import { providerFetch } from "./http";
import {
  type SynthOptions,
  type SynthResult,
  type VoiceModel,
  type VoiceProvider,
  type VoiceSummary,
} from "./types";

const API_BASE = "https://api.elevenlabs.io";
export const ELEVENLABS_DEFAULT_MODEL = "eleven_multilingual_v2";

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

export function createElevenLabsProvider(): VoiceProvider {
  const key = () => process.env.ELEVENLABS_API_KEY?.trim() || "";
  const headers = () => ({ "xi-api-key": key() });

  return {
    id: "elevenlabs",
    label: "ElevenLabs",
    runtime: "server",

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

      // wav_44100 returns a 16-bit PCM WAV directly, matching our pipeline target.
      const res = await providerFetch(
        `${API_BASE}/v1/text-to-speech/${encodeURIComponent(opts.voiceId)}?output_format=wav_44100`,
        {
          method: "POST",
          headers: { ...headers(), "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        "elevenlabs",
      );

      const wav = Buffer.from(await res.arrayBuffer());
      const info = parseWav(wav);
      return { wav, sampleRate: info.sampleRate };
    },
  };
}
