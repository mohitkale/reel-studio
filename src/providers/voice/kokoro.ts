import { type VoiceModel, type VoiceProvider, type VoiceSummary } from "./types";

/**
 * Kokoro provider — in-browser, client-runtime TTS.
 *
 * Kokoro is an Apache-2.0 82M-parameter model that runs in the browser via
 * WASM/ONNX (kokoro-js). Synthesis happens entirely on the user's machine —
 * free, commercial-safe, no install, and zero load on the server. There is no
 * server-side synth(): the browser generates per-scene WAVs and uploads them via
 * /api/scripts/[id]/takes/upload. This stub exposes the full voice/model
 * catalog so the editor's pickers work like any other provider.
 */
export const KOKORO_DEFAULT_MODEL = "kokoro-82M";

/** Hugging Face repo for the Kokoro ONNX weights (shared by client + server). */
export const KOKORO_MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";

/** Language groups for the 54 Kokoro-82M v1.0 voices (kokoro-js). */
export const KOKORO_LANGUAGE_GROUPS = [
  { id: "en-US", label: "American English" },
  { id: "en-GB", label: "British English" },
  { id: "es", label: "Spanish" },
  { id: "fr", label: "French" },
  { id: "hi", label: "Hindi" },
  { id: "it", label: "Italian" },
  { id: "ja", label: "Japanese" },
  { id: "pt-BR", label: "Portuguese (Brazil)" },
  { id: "zh", label: "Mandarin Chinese" },
] as const;

export type KokoroLanguageId = (typeof KOKORO_LANGUAGE_GROUPS)[number]["id"];

const LANG_LABEL: Record<string, string> = Object.fromEntries(
  KOKORO_LANGUAGE_GROUPS.map((g) => [g.id, g.label]),
);

/** Human label for a Kokoro language code (falls back to the raw code). */
export function kokoroLanguageLabel(language?: string): string {
  if (!language) return "Other";
  return LANG_LABEL[language] ?? language;
}

function voice(
  id: string,
  name: string,
  language: KokoroLanguageId,
  gender: "female" | "male",
): VoiceSummary {
  return {
    id,
    name,
    category: "default",
    language,
    tags: [gender],
  };
}

/**
 * Full Kokoro-82M v1.0 catalog (54 voices). Ids MUST match kokoro-js / the
 * bundled `voices/*.bin` files exactly. Shared by in-browser + server providers.
 */
export const KOKORO_VOICES: VoiceSummary[] = [
  // American English — female
  voice("af_heart", "Heart — US female", "en-US", "female"),
  voice("af_alloy", "Alloy — US female", "en-US", "female"),
  voice("af_aoede", "Aoede — US female", "en-US", "female"),
  voice("af_bella", "Bella — US female", "en-US", "female"),
  voice("af_jessica", "Jessica — US female", "en-US", "female"),
  voice("af_kore", "Kore — US female", "en-US", "female"),
  voice("af_nicole", "Nicole — US female", "en-US", "female"),
  voice("af_nova", "Nova — US female", "en-US", "female"),
  voice("af_river", "River — US female", "en-US", "female"),
  voice("af_sarah", "Sarah — US female", "en-US", "female"),
  voice("af_sky", "Sky — US female", "en-US", "female"),
  // American English — male
  voice("am_adam", "Adam — US male", "en-US", "male"),
  voice("am_echo", "Echo — US male", "en-US", "male"),
  voice("am_eric", "Eric — US male", "en-US", "male"),
  voice("am_fenrir", "Fenrir — US male", "en-US", "male"),
  voice("am_liam", "Liam — US male", "en-US", "male"),
  voice("am_michael", "Michael — US male", "en-US", "male"),
  voice("am_onyx", "Onyx — US male", "en-US", "male"),
  voice("am_puck", "Puck — US male", "en-US", "male"),
  voice("am_santa", "Santa — US male", "en-US", "male"),
  // British English — female
  voice("bf_alice", "Alice — UK female", "en-GB", "female"),
  voice("bf_emma", "Emma — UK female", "en-GB", "female"),
  voice("bf_isabella", "Isabella — UK female", "en-GB", "female"),
  voice("bf_lily", "Lily — UK female", "en-GB", "female"),
  // British English — male
  voice("bm_daniel", "Daniel — UK male", "en-GB", "male"),
  voice("bm_fable", "Fable — UK male", "en-GB", "male"),
  voice("bm_george", "George — UK male", "en-GB", "male"),
  voice("bm_lewis", "Lewis — UK male", "en-GB", "male"),
  // Spanish
  voice("ef_dora", "Dora — Spanish female", "es", "female"),
  voice("em_alex", "Alex — Spanish male", "es", "male"),
  voice("em_santa", "Santa — Spanish male", "es", "male"),
  // French
  voice("ff_siwis", "Siwis — French female", "fr", "female"),
  // Hindi
  voice("hf_alpha", "Alpha — Hindi female", "hi", "female"),
  voice("hf_beta", "Beta — Hindi female", "hi", "female"),
  voice("hm_omega", "Omega — Hindi male", "hi", "male"),
  voice("hm_psi", "Psi — Hindi male", "hi", "male"),
  // Italian
  voice("if_sara", "Sara — Italian female", "it", "female"),
  voice("im_nicola", "Nicola — Italian male", "it", "male"),
  // Japanese
  voice("jf_alpha", "Alpha — Japanese female", "ja", "female"),
  voice("jf_gongitsune", "Gongitsune — Japanese female", "ja", "female"),
  voice("jf_nezumi", "Nezumi — Japanese female", "ja", "female"),
  voice("jf_tebukuro", "Tebukuro — Japanese female", "ja", "female"),
  voice("jm_kumo", "Kumo — Japanese male", "ja", "male"),
  // Portuguese (Brazil)
  voice("pf_dora", "Dora — Portuguese female", "pt-BR", "female"),
  voice("pm_alex", "Alex — Portuguese male", "pt-BR", "male"),
  voice("pm_santa", "Santa — Portuguese male", "pt-BR", "male"),
  // Mandarin Chinese
  voice("zf_xiaobei", "Xiaobei — Mandarin female", "zh", "female"),
  voice("zf_xiaoni", "Xiaoni — Mandarin female", "zh", "female"),
  voice("zf_xiaoxiao", "Xiaoxiao — Mandarin female", "zh", "female"),
  voice("zf_xiaoyi", "Xiaoyi — Mandarin female", "zh", "female"),
  voice("zm_yunjian", "Yunjian — Mandarin male", "zh", "male"),
  voice("zm_yunxi", "Yunxi — Mandarin male", "zh", "male"),
  voice("zm_yunxia", "Yunxia — Mandarin male", "zh", "male"),
  voice("zm_yunyang", "Yunyang — Mandarin male", "zh", "male"),
];

export const KOKORO_VOICE_IDS = KOKORO_VOICES.map((v) => v.id);

/** Kokoro model list (one model). Shared by the client + server providers. */
export function kokoroModels(): VoiceModel[] {
  return [{ id: KOKORO_DEFAULT_MODEL, label: "Kokoro 82M (Apache-2.0)" }];
}

export interface FilterKokoroVoicesOptions {
  /** Search query (name or id). */
  query?: string;
  /**
   * Whitelist of voice ids to show. `null` / `undefined` / empty = show all
   * (the default). Invalid ids are ignored.
   */
  visibleIds?: string[] | null;
}

/** Filter the Kokoro catalog by optional search + visibility whitelist. */
export function filterKokoroVoices(
  queryOrOpts?: string | FilterKokoroVoicesOptions,
  maybeOpts?: FilterKokoroVoicesOptions,
): VoiceSummary[] {
  const opts: FilterKokoroVoicesOptions =
    typeof queryOrOpts === "string"
      ? { query: queryOrOpts, ...maybeOpts }
      : (queryOrOpts ?? {});

  const allowed =
    opts.visibleIds && opts.visibleIds.length > 0
      ? new Set(opts.visibleIds)
      : null;

  let voices = allowed
    ? KOKORO_VOICES.filter((v) => allowed.has(v.id))
    : KOKORO_VOICES;

  // If a whitelist was set but nothing matched (stale ids), fall back to all.
  if (allowed && voices.length === 0) voices = KOKORO_VOICES;

  const q = opts.query?.trim().toLowerCase();
  if (!q) return voices;
  return voices.filter(
    (v) =>
      v.name.toLowerCase().includes(q) ||
      v.id.toLowerCase().includes(q) ||
      (v.language?.toLowerCase().includes(q) ?? false) ||
      kokoroLanguageLabel(v.language).toLowerCase().includes(q),
  );
}

export function createKokoroProvider(): VoiceProvider {
  return {
    id: "kokoro",
    label: "Kokoro (in-browser, free)",
    runtime: "client",

    isConfigured: () => true,

    listModels: async () => kokoroModels(),
    // Visibility whitelist is applied in /api/providers/:id/voices from app-config.
    listVoices: async (query?: string) => filterKokoroVoices(query),

    // No synth(): the browser generates audio and uploads it as a take.
  };
}
