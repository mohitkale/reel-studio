import { z } from "zod";

import { parseWav, TARGET_SAMPLE_RATE } from "@/lib/wav";
import { providerFetch } from "./http";
import {
  type SynthOptions,
  type SynthResult,
  type VoiceModel,
  type VoiceProvider,
  type VoiceSummary,
} from "./types";

const API_BASE = "https://api.cartesia.ai";
const CARTESIA_VERSION = "2026-03-01";
export const CARTESIA_DEFAULT_MODEL = "sonic-3.5";

// Cartesia has no public "list models" endpoint; these are the current TTS models.
const MODELS: VoiceModel[] = [
  { id: "sonic-3.5", label: "Sonic 3.5 (latest)" },
  { id: "sonic-2", label: "Sonic 2" },
];

const cartesiaVoiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  is_owner: z.boolean().nullish(),
  is_public: z.boolean().nullish(),
  language: z.string().nullish(),
  gender: z.string().nullish(),
  preview_file_url: z.string().nullish(),
});

const cartesiaListSchema = z.object({
  data: z.array(cartesiaVoiceSchema),
  has_more: z.boolean().nullish(),
  next_page: z.string().nullish(),
});

type CartesiaVoice = z.infer<typeof cartesiaVoiceSchema>;

function mapVoice(v: CartesiaVoice): VoiceSummary {
  const category: VoiceSummary["category"] = v.is_owner
    ? "cloned"
    : v.is_public
      ? "default"
      : "shared";
  return {
    id: v.id,
    name: v.name,
    category,
    language: v.language ?? undefined,
    previewUrl: v.preview_file_url ?? undefined,
    tags: v.gender ? [v.gender] : undefined,
  };
}

export function createCartesiaProvider(): VoiceProvider {
  const key = () => process.env.CARTESIA_API_KEY?.trim() || "";

  const headers = () => ({
    Authorization: `Bearer ${key()}`,
    "Cartesia-Version": CARTESIA_VERSION,
  });

  async function fetchPage(params: URLSearchParams): Promise<VoiceSummary[]> {
    const res = await providerFetch(
      `${API_BASE}/voices?${params.toString()}`,
      { method: "GET", headers: headers() },
      "cartesia",
    );
    const json = cartesiaListSchema.parse(await res.json());
    return json.data.map(mapVoice);
  }

  return {
    id: "cartesia",
    label: "Cartesia",
    runtime: "server",

    isConfigured: () => key().length > 0,

    async listModels() {
      return MODELS;
    },

    async listVoices(query?: string) {
      const base = new URLSearchParams({ limit: "100" });
      base.append("expand[]", "preview_file_url");
      if (query) base.set("q", query);

      const owned = new URLSearchParams(base);
      owned.set("is_owner", "true");

      // Owned/cloned voices and the public library, merged and de-duplicated.
      const [mine, library] = await Promise.all([
        fetchPage(owned),
        fetchPage(base),
      ]);

      const byId = new Map<string, VoiceSummary>();
      for (const v of [...mine, ...library]) {
        // Prefer the "cloned" classification when a voice appears in both lists.
        const existing = byId.get(v.id);
        if (!existing || v.category === "cloned") byId.set(v.id, v);
      }
      return [...byId.values()];
    },

    async synth(opts: SynthOptions): Promise<SynthResult> {
      const sampleRate = opts.sampleRate ?? TARGET_SAMPLE_RATE;
      const generationConfig: Record<string, unknown> = {};
      if (opts.speed !== undefined) generationConfig.speed = opts.speed;
      if (opts.emotion !== undefined) generationConfig.emotion = opts.emotion;

      const body = {
        model_id: opts.modelId ?? CARTESIA_DEFAULT_MODEL,
        transcript: opts.text,
        voice: { mode: "id", id: opts.voiceId },
        output_format: {
          container: "wav",
          encoding: "pcm_s16le",
          sample_rate: sampleRate,
        },
        language: opts.language ?? "en",
        ...(Object.keys(generationConfig).length
          ? { generation_config: generationConfig }
          : {}),
      };

      const res = await providerFetch(
        `${API_BASE}/tts/bytes`,
        {
          method: "POST",
          headers: { ...headers(), "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        "cartesia",
      );

      const wav = Buffer.from(await res.arrayBuffer());
      const info = parseWav(wav); // validates it really is a PCM WAV
      return { wav, sampleRate: info.sampleRate };
    },
  };
}
