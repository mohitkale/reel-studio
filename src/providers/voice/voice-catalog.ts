import {
  DEFAULT_KOKORO_VOICE_BY_LANGUAGE,
  KOKORO_LANGUAGE_GROUPS,
  KOKORO_VOICES,
  kokoroLanguageLabel,
  type KokoroLanguageId,
} from "./kokoro";

/**
 * The voice gallery's data and the language rules for a storyboard (roadmap P5).
 * Pure: nothing here calls a provider.
 */
export const STORYBOARD_LANGUAGES = KOKORO_LANGUAGE_GROUPS.map(
  (group) => group.id,
) as readonly KokoroLanguageId[];

const ALIASES: Record<string, KokoroLanguageId> = {
  en: "en-US",
  "en-us": "en-US",
  english: "en-US",
  "en-gb": "en-GB",
  es: "es",
  "es-es": "es",
  "es-mx": "es",
  spanish: "es",
  fr: "fr",
  "fr-fr": "fr",
  french: "fr",
  hi: "hi",
  "hi-in": "hi",
  hindi: "hi",
  it: "it",
  "it-it": "it",
  italian: "it",
  ja: "ja",
  "ja-jp": "ja",
  japanese: "ja",
  pt: "pt-BR",
  "pt-br": "pt-BR",
  portuguese: "pt-BR",
  zh: "zh",
  "zh-cn": "zh",
  cmn: "zh",
  mandarin: "zh",
  chinese: "zh",
};

/** A language code a writer might use, mapped to one of ours; undefined when unknown. */
export function normalizeLanguageCode(
  value: unknown,
): KokoroLanguageId | undefined {
  if (typeof value !== "string") return undefined;
  return ALIASES[value.trim().toLowerCase().replace(/_/g, "-")];
}

const baseLanguage = (language: string) => language.split("-")[0]!;

export type VoiceGender = "female" | "male";

/** Short, plain tone words for the voices that have been picked as a starting set. */
const TONES: Record<string, string[]> = {
  af_heart: ["warm", "friendly"],
  af_nova: ["bright", "upbeat"],
  am_michael: ["steady", "clear"],
  am_adam: ["calm", "even"],
  bf_emma: ["clear", "polished"],
  bm_george: ["deep", "authoritative"],
};

export interface GalleryVoice {
  id: string;
  name: string;
  language: KokoroLanguageId;
  languageLabel: string;
  gender: VoiceGender;
  tone: string[];
  /** The suggested voice for its language. */
  recommended: boolean;
}

export const GALLERY_VOICES: readonly GalleryVoice[] = KOKORO_VOICES.map(
  (voice) => {
    const language = voice.language as KokoroLanguageId;
    return {
      id: voice.id,
      name: voice.name.split(" — ")[0]!,
      language,
      languageLabel: kokoroLanguageLabel(language),
      gender: (voice.tags?.includes("male") ? "male" : "female") as VoiceGender,
      tone: TONES[voice.id] ?? [],
      recommended: DEFAULT_KOKORO_VOICE_BY_LANGUAGE[language] === voice.id,
    };
  },
);

export interface GalleryFilter {
  language?: string;
  gender?: VoiceGender;
  tone?: string;
  /** Only these ids (the person's favourites). */
  only?: readonly string[];
}

export function filterGallery(
  voices: readonly GalleryVoice[],
  filter: GalleryFilter,
): GalleryVoice[] {
  return voices.filter(
    (voice) =>
      (!filter.language || voice.language === filter.language) &&
      (!filter.gender || voice.gender === filter.gender) &&
      (!filter.tone || voice.tone.includes(filter.tone)) &&
      (!filter.only || filter.only.includes(voice.id)),
  );
}

/** Every tone word in use, for the filter. */
export function galleryTones(): string[] {
  return [...new Set(GALLERY_VOICES.flatMap((voice) => voice.tone))].sort();
}

/** The language a Kokoro voice speaks, or undefined for a voice we do not know. */
export function voiceLanguage(voiceId: string): KokoroLanguageId | undefined {
  return GALLERY_VOICES.find((voice) => voice.id === voiceId)?.language;
}

/** A voice speaks a video's language when the base language matches (US and UK English both speak English). */
export function voiceSupportsLanguage(
  voiceId: string,
  language: string,
): boolean {
  const spoken = voiceLanguage(voiceId);
  return !spoken || baseLanguage(spoken) === baseLanguage(language);
}

/** The voice to use for a language when the storyboard names none. */
export function defaultVoiceForLanguage(
  language: string | undefined,
): string | undefined {
  return language ? DEFAULT_KOKORO_VOICE_BY_LANGUAGE[language] : undefined;
}

/**
 * How well the local voice reads a language. This build's phonemizer carries
 * the English dictionary only, so the other languages are read with English
 * pronunciation rules: the voice is right, the pronunciation is approximate.
 */
export function languageSupport(language: string): "native" | "limited" {
  return baseLanguage(language) === "en" ? "native" : "limited";
}
