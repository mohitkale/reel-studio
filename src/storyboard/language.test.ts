import { describe, expect, it } from "vitest";

import { lintStoryboard } from "./lint";

const scenes = [
  {
    type: "hook",
    headline: "Hola",
    narration: "Una pregunta que importa mucho hoy.",
  },
  {
    type: "statement",
    headline: "La idea",
    narration: "Esta es la idea principal del video.",
  },
  {
    type: "cta",
    headline: "Gracias",
    narration: "Gracias por ver este video hasta el final.",
  },
];
const base = { version: 1, title: "Idioma", scenes };
const lint = (input: unknown) =>
  lintStoryboard(input, { minSeconds: 1, maxSeconds: 1000 });

describe("storyboard language and voice style", () => {
  it("maps a language alias to a code", () => {
    const result = lint({ ...base, language: "Spanish" });
    expect(result.errors).toEqual([]);
    expect(result.storyboard?.language).toBe("es");
    expect(result.fixes.map((f) => f.path)).toContain("language");
  });

  it("drops a language it cannot read instead of failing", () => {
    const result = lint({ ...base, language: "klingon" });
    expect(result.errors).toEqual([]);
    expect(result.storyboard?.language).toBeUndefined();
  });

  it("swaps a voice that speaks another language", () => {
    const result = lint({
      ...base,
      language: "es",
      voice: { voiceId: "af_heart" },
    });
    expect(
      result.storyboard?.kind === "video" && result.storyboard.voice?.voiceId,
    ).toBe("ef_dora");
    expect(result.fixes.some((f) => f.rule === "match-voice-language")).toBe(
      true,
    );
  });

  it("keeps a voice that speaks the language, and treats US and UK English as one", () => {
    const keep = lint({
      ...base,
      language: "es",
      voice: { voiceId: "em_alex" },
    });
    expect(keep.fixes.some((f) => f.rule === "match-voice-language")).toBe(
      false,
    );
    const english = lint({
      ...base,
      language: "en-GB",
      voice: { voiceId: "af_heart" },
    });
    expect(english.fixes.some((f) => f.rule === "match-voice-language")).toBe(
      false,
    );
  });

  it("warns that non-English pronunciation is approximate on the local voice", () => {
    const result = lint({ ...base, language: "fr" });
    expect(
      result.warnings.some((w) => w.rule === "language-pronunciation"),
    ).toBe(true);
    expect(
      lint({ ...base, language: "en-GB" }).warnings.some(
        (w) => w.rule === "language-pronunciation",
      ),
    ).toBe(false);
  });

  it("accepts a voice style and drops an unknown one", () => {
    const ok = lint({ ...base, voice: { style: "calm" } });
    expect(ok.errors).toEqual([]);
    expect(ok.storyboard?.kind === "video" && ok.storyboard.voice?.style).toBe(
      "calm",
    );
    const bad = lint({ ...base, voice: { style: "robot" } });
    expect(bad.errors).toEqual([]);
    expect(
      bad.storyboard?.kind === "video" && bad.storyboard.voice?.style,
    ).toBeUndefined();
  });
});
