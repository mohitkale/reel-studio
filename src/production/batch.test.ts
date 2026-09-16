import { describe, expect, it } from "vitest";

import {
  expandProductionBatch,
  productionBatchRequestSchema,
} from "@/production/batch";

describe("production batch contracts", () => {
  it("reflows a video row into all three formats by default", () => {
    const batch = productionBatchRequestSchema.parse({
      idempotencyKey: "launch-batch",
      rows: [{ kind: "video", scriptId: "script-1", label: "Launch" }],
    });
    const items = expandProductionBatch(batch);
    expect(items.map((item) => item.orientation)).toEqual([
      "portrait",
      "landscape",
      "square",
    ]);
    expect(items.map((item) => item.request.idempotencyKey)).toEqual([
      "launch-batch:row-1:portrait",
      "launch-batch:row-1:landscape",
      "launch-batch:row-1:square",
    ]);
  });

  it("honors explicit variants without multiplying audio rows", () => {
    const batch = productionBatchRequestSchema.parse({
      idempotencyKey: "mixed-batch",
      rows: [
        {
          kind: "video",
          key: "demo",
          scriptId: "script-1",
          orientations: ["square"],
        },
        { kind: "audio", scriptId: "script-2", placeholder: true },
      ],
    });
    const items = expandProductionBatch(batch);
    expect(items).toHaveLength(2);
    expect(items[0]?.request.idempotencyKey).toBe("mixed-batch:demo:square");
    expect(items[1]?.request.kind).toBe("audio");
  });

  it("keeps per-row Quick Produce preferences on every video variant", () => {
    const batch = productionBatchRequestSchema.parse({
      idempotencyKey: "quick-batch",
      rows: [
        {
          kind: "video",
          scriptId: "script-1",
          orientations: ["portrait", "square"],
          quickProduce: {
            enabled: true,
            planner: "deterministic",
            mediaPreference: "none",
            voice: {
              enabled: true,
              providerId: "kokoro-server",
              voiceId: "af_heart",
            },
          },
        },
      ],
    });
    expect(expandProductionBatch(batch)).toEqual([
      expect.objectContaining({
        orientation: "portrait",
        request: expect.objectContaining({
          quickProduce: expect.objectContaining({ mediaPreference: "none" }),
        }),
      }),
      expect.objectContaining({
        orientation: "square",
        request: expect.objectContaining({
          quickProduce: expect.objectContaining({ mediaPreference: "none" }),
        }),
      }),
    ]);
  });

  it("rejects duplicate row keys and more than ten inputs", () => {
    expect(() =>
      productionBatchRequestSchema.parse({
        idempotencyKey: "duplicate-rows",
        rows: [
          { kind: "audio", key: "same", scriptId: "one", placeholder: true },
          { kind: "audio", key: "same", scriptId: "two", placeholder: true },
        ],
      }),
    ).toThrow("Duplicate row key");
    expect(() =>
      productionBatchRequestSchema.parse({
        idempotencyKey: "too-many-rows",
        rows: Array.from({ length: 11 }, (_, index) => ({
          kind: "audio",
          scriptId: `script-${index}`,
          placeholder: true,
        })),
      }),
    ).toThrow();
  });
});
