import { describe, it, expect } from "vitest";

import { hasSpokenContent, resolveSpokenText } from "./spoken-text";

describe("resolveSpokenText", () => {
  it("uses display text when spokenText is null", () => {
    expect(resolveSpokenText({ text: "On screen", spokenText: null })).toBe(
      "On screen",
    );
  });

  it("uses spoken override when set", () => {
    expect(
      resolveSpokenText({ text: "On screen", spokenText: "Narration line" }),
    ).toBe("Narration line");
  });

  it("allows empty spoken override for silent holds", () => {
    expect(resolveSpokenText({ text: "On screen", spokenText: "" })).toBe("");
    expect(hasSpokenContent({ text: "On screen", spokenText: "" })).toBe(false);
  });
});
