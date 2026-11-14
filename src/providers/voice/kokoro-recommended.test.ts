import { describe, expect, it } from "vitest";

import {
  DEFAULT_KOKORO_VOICE_BY_LANGUAGE,
  KOKORO_LANGUAGE_GROUPS,
  KOKORO_VOICE_IDS,
  RECOMMENDED_KOKORO_VOICES,
} from "./kokoro";

describe("recommended Kokoro voices", () => {
  it("offers six voices that exist", () => {
    expect(RECOMMENDED_KOKORO_VOICES).toHaveLength(6);
    for (const id of RECOMMENDED_KOKORO_VOICES)
      expect(KOKORO_VOICE_IDS).toContain(id);
  });

  it("has a default narrator for every language", () => {
    for (const group of KOKORO_LANGUAGE_GROUPS) {
      expect(KOKORO_VOICE_IDS).toContain(
        DEFAULT_KOKORO_VOICE_BY_LANGUAGE[group.id],
      );
    }
  });
});
