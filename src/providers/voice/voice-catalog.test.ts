import { describe, expect, it } from "vitest";

import {
  GALLERY_VOICES,
  defaultVoiceForLanguage,
  filterGallery,
  galleryTones,
  languageSupport,
  normalizeLanguageCode,
  voiceSupportsLanguage,
} from "./voice-catalog";

describe("voice gallery", () => {
  it("lists every Kokoro voice with a language and a gender", () => {
    expect(GALLERY_VOICES).toHaveLength(54);
    expect(GALLERY_VOICES.every((v) => v.language && v.gender)).toBe(true);
    expect(GALLERY_VOICES.filter((v) => v.recommended)).toHaveLength(9);
  });

  it("filters by language, gender, tone and favourites", () => {
    expect(
      filterGallery(GALLERY_VOICES, { language: "es" }).map((v) => v.id),
    ).toEqual(["ef_dora", "em_alex", "em_santa"]);
    expect(
      filterGallery(GALLERY_VOICES, {
        language: "en-US",
        gender: "male",
        tone: "calm",
      }).map((v) => v.id),
    ).toEqual(["am_adam"]);
    expect(filterGallery(GALLERY_VOICES, { only: ["bf_emma"] })).toHaveLength(
      1,
    );
    expect(galleryTones()).toContain("warm");
  });

  it("matches a voice to a video language", () => {
    expect(voiceSupportsLanguage("af_heart", "en-GB")).toBe(true);
    expect(voiceSupportsLanguage("af_heart", "fr")).toBe(false);
    expect(voiceSupportsLanguage("ff_siwis", "fr")).toBe(true);
    // A voice we do not know (a cloud voice) is never second-guessed.
    expect(voiceSupportsLanguage("custom-123", "fr")).toBe(true);
    expect(defaultVoiceForLanguage("hi")).toBe("hf_alpha");
    expect(defaultVoiceForLanguage(undefined)).toBeUndefined();
  });

  it("reads language names and codes", () => {
    expect(normalizeLanguageCode("pt")).toBe("pt-BR");
    expect(normalizeLanguageCode("Japanese")).toBe("ja");
    expect(normalizeLanguageCode("zh_CN")).toBe("zh");
    expect(normalizeLanguageCode("xx")).toBeUndefined();
    expect(normalizeLanguageCode(5)).toBeUndefined();
  });

  it("is honest that only English has full pronunciation support locally", () => {
    expect(languageSupport("en-US")).toBe("native");
    expect(languageSupport("es")).toBe("limited");
  });
});
