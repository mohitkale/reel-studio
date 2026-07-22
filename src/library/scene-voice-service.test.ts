import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";

import { isClipFreshForText } from "@/library/scene-voice-service";
import { hashSpokenText } from "@/library/scene-audio-cache";

describe("hasSpokenText", () => {
  it("is false for blank and whitespace", async () => {
    const { hasSpokenText } = await import("@/library/scene-voice-service");
    expect(hasSpokenText("")).toBe(false);
    expect(hasSpokenText("   ")).toBe(false);
    expect(hasSpokenText("Hello")).toBe(true);
  });
});

describe("hashSpokenText", () => {
  it("matches sha1 of the spoken text", () => {
    const text = "Hello world";
    expect(hashSpokenText(text)).toBe(
      createHash("sha1").update(text).digest("hex"),
    );
  });

  it("changes when text changes", () => {
    expect(hashSpokenText("Hello")).not.toBe(hashSpokenText("Goodbye"));
  });
});

describe("isClipFreshForText", () => {
  it("is fresh when hash matches current scene text", () => {
    const text = "Spoken note for scene one";
    expect(isClipFreshForText(hashSpokenText(text), text)).toBe(true);
  });

  it("is stale when scene text changed after synth", () => {
    const original = "Original line";
    const hash = hashSpokenText(original);
    expect(isClipFreshForText(hash, "Edited line")).toBe(false);
  });
});
