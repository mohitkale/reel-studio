import { describe, expect, it } from "vitest";

import { DEFAULT_PACING, planPacing } from "./kokoro-chunks";
import {
  VOICE_STYLES,
  VOICE_STYLE_IDS,
  pacingForStyle,
  pitchRatio,
  styledSpeed,
} from "./voice-styles";

describe("voice styles", () => {
  it("keeps every pitch within two semitones", () => {
    for (const id of VOICE_STYLE_IDS) {
      expect(Math.abs(VOICE_STYLES[id].pitch)).toBeLessThanOrEqual(2);
      const ratio = pitchRatio(id);
      expect(ratio).toBeGreaterThan(2 ** (-2 / 12) - 1e-9);
      expect(ratio).toBeLessThan(2 ** (2 / 12) + 1e-9);
    }
    expect(pitchRatio(undefined)).toBe(1);
  });

  it("makes four distinct plans from the same text", () => {
    const text =
      "Sleep matters more than most people think. Here is why it matters. Seven hours. Not five.";
    const plans = VOICE_STYLE_IDS.map((id) => {
      const total = planPacing(text, pacingForStyle(id, DEFAULT_PACING)).reduce(
        (sum, chunk) => sum + chunk.pauseBefore,
        0,
      );
      return `${total.toFixed(3)}|${styledSpeed(id, 1)}|${VOICE_STYLES[id].pitch}`;
    });
    expect(new Set(plans).size).toBe(4);
    // Calm and storyteller pause longer than news and energetic.
    const pauses = (id: (typeof VOICE_STYLE_IDS)[number]) =>
      planPacing(text, pacingForStyle(id, DEFAULT_PACING)).reduce(
        (s, c) => s + c.pauseBefore,
        0,
      );
    expect(pauses("storyteller")).toBeGreaterThan(pauses("calm"));
    expect(pauses("calm")).toBeGreaterThan(pauses("news"));
  });

  it("is deterministic and multiplies the video's own speed", () => {
    expect(styledSpeed("calm", 1)).toBe(styledSpeed("calm", 1));
    expect(styledSpeed("news", 1.2)).toBeCloseTo(1.2 * 1.05);
    expect(styledSpeed(undefined, 1.2)).toBe(1.2);
    expect(styledSpeed(undefined, undefined)).toBeUndefined();
  });
});
