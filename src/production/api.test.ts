import { describe, expect, it } from "vitest";

import { produceContentRequestSchema } from "@/production/api";

describe("production API contract", () => {
  it("accepts each single-content production kind with stable defaults", () => {
    expect(
      produceContentRequestSchema.parse({
        kind: "video",
        idempotencyKey: "video-request",
        scriptId: "script",
      }),
    ).toMatchObject({ quality: "standard", runMode: "automatic" });
    expect(
      produceContentRequestSchema.parse({
        kind: "audio",
        idempotencyKey: "audio-request",
        scriptId: "script",
        placeholder: true,
      }),
    ).toMatchObject({ placeholder: true });
    expect(
      produceContentRequestSchema.parse({
        kind: "podcast",
        idempotencyKey: "podcast-request",
        podcastId: "podcast",
      }),
    ).toMatchObject({ kind: "podcast" });
    expect(
      produceContentRequestSchema.parse({
        kind: "audiogram",
        idempotencyKey: "audiogram-request",
        takeId: "take",
        startTurnId: "one",
        endTurnId: "two",
      }),
    ).toMatchObject({ orientation: "portrait", quality: "standard" });
  });

  it("rejects missing kind-specific references", () => {
    expect(() =>
      produceContentRequestSchema.parse({
        kind: "audiogram",
        idempotencyKey: "invalid-request",
        takeId: "take",
      }),
    ).toThrow();
  });

  it("shares Quick Produce media and narration preferences with prepared video requests", () => {
    expect(
      produceContentRequestSchema.parse({
        kind: "video",
        idempotencyKey: "quick-video-request",
        scriptId: "script",
        quickProduce: {
          enabled: true,
          planner: "ollama",
          plannerModelId: "qwen-local",
          mediaPreference: "video",
          voice: {
            enabled: true,
            providerId: "kokoro-server",
            voiceId: "af_heart",
          },
        },
      }),
    ).toMatchObject({
      quickProduce: {
        planner: "ollama",
        mediaPreference: "video",
        voice: { providerId: "kokoro-server" },
      },
    });
  });
});
