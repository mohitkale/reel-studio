import { z } from "zod";

import { parseWav, TARGET_SAMPLE_RATE } from "@/lib/wav";
import {
  isVoiceforgeConfigured,
  voiceforgeAuthHeaders,
  voiceforgeBaseUrl,
  voiceforgePreviewProxyUrl,
} from "@/server/voiceforge-client";
import { providerFetch } from "./http";
import {
  voiceforgeEngineOptionLabel,
} from "./voiceforge-engines";
import {
  ProviderError,
  type SynthOptions,
  type SynthResult,
  type VoiceModel,
  type VoiceProvider,
  type VoiceSummary,
} from "./types";

export const VOICEFORGE_DEFAULT_MODEL = "xtts-v2";

/** Local CPU XTTS can take several minutes per scene; match VoiceForge's httpx guidance. */
export const VOICEFORGE_SYNTH_TIMEOUT_MS = 600_000;

const engineSchema = z.object({
  id: z.string(),
  label: z.string(),
  ready: z.boolean(),
  configured: z.boolean().optional(),
});

const voiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  engineId: z.string(),
  tier: z.enum(["instant", "high_fidelity"]),
  status: z.enum(["processing", "ready", "failed"]),
  language: z.string().optional(),
  previewUrl: z.string().nullish(),
});

function mapVoice(v: z.infer<typeof voiceSchema>): VoiceSummary {
  return {
    id: v.id,
    name: v.name,
    category: "cloned",
    language: v.language,
    previewUrl: v.previewUrl ? voiceforgePreviewProxyUrl(v.id) : undefined,
    tags: [v.engineId, v.tier],
  };
}

function filterByQuery(voices: VoiceSummary[], query?: string): VoiceSummary[] {
  if (!query?.trim()) return voices;
  const q = query.trim().toLowerCase();
  return voices.filter(
    (v) =>
      v.name.toLowerCase().includes(q) ||
      v.id.toLowerCase().includes(q) ||
      v.tags?.some((t) => t.toLowerCase().includes(q)),
  );
}

export function createVoiceforgeProvider(): VoiceProvider {
  const base = () => voiceforgeBaseUrl();
  const headers = () => ({
    ...voiceforgeAuthHeaders(),
    Accept: "application/json",
  });

  return {
    id: "voiceforge",
    label: "VoiceForge (local clone)",
    runtime: "server",
    keyless: true,
    maxConcurrency: 1,

    isConfigured: () => isVoiceforgeConfigured(),

    async listModels() {
      const res = await providerFetch(
        `${base()}/v1/engines`,
        { method: "GET", headers: headers() },
        "voiceforge",
      );
      const engines = z.array(engineSchema).parse(await res.json());
      return engines
        .filter((e) => e.ready)
        .map<VoiceModel>((e) => ({
          id: e.id,
          label: voiceforgeEngineOptionLabel(e.id, e.label),
        }));
    },

    async listVoices(query?: string) {
      const res = await providerFetch(
        `${base()}/v1/voices`,
        { method: "GET", headers: headers() },
        "voiceforge",
      );
      const voices = z.array(voiceSchema).parse(await res.json());
      const ready = voices.filter((v) => v.status === "ready").map(mapVoice);
      return filterByQuery(ready, query);
    },

    async synth(opts: SynthOptions): Promise<SynthResult> {
      const text = opts.text.trim();
      if (!text) {
        throw new ProviderError(
          "Scene text is empty — add dialogue before synthesizing with VoiceForge.",
          400,
          "voiceforge",
        );
      }

      const body: Record<string, unknown> = {
        voiceId: opts.voiceId,
        text,
        sampleRate: opts.sampleRate ?? TARGET_SAMPLE_RATE,
      };
      if (opts.speed !== undefined) body.speed = opts.speed;
      if (opts.language !== undefined) body.language = opts.language;

      const started = Date.now();
      console.log(
        `[voiceforge] synth start voice=${opts.voiceId} chars=${text.length}`,
      );

      const res = await providerFetch(
        `${base()}/v1/synthesize`,
        {
          method: "POST",
          headers: {
            ...voiceforgeAuthHeaders(),
            Accept: "audio/wav",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
        "voiceforge",
        { timeoutMs: VOICEFORGE_SYNTH_TIMEOUT_MS },
      );

      const wav = Buffer.from(await res.arrayBuffer());
      const info = parseWav(wav);
      console.log(
        `[voiceforge] synth done voice=${opts.voiceId} in ${Date.now() - started}ms (${info.durationSeconds.toFixed(1)}s audio)`,
      );
      return { wav, sampleRate: info.sampleRate };
    },
  };
}
