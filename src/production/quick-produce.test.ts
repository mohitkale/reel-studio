import { describe, expect, it } from "vitest";

import {
  DEFAULT_QUICK_PRODUCE_ENABLED,
  quickProduceOptionsSchema,
} from "@/production/quick-produce";

describe("Quick Produce contract", () => {
  it("is explicitly off by default", () => {
    expect(DEFAULT_QUICK_PRODUCE_ENABLED).toBe(false);
  });

  it("defaults to credential-free planning and local Kokoro narration", () => {
    expect(quickProduceOptionsSchema.parse({ enabled: true })).toEqual({
      enabled: true,
      planner: "deterministic",
      mediaPreference: "auto",
      voice: {
        enabled: true,
        providerId: "kokoro-server",
        voiceId: "af_heart",
      },
    });
  });
});
