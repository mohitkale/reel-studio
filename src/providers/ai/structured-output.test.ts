import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  extractCompleteJSONObject,
  localModelCapabilityGuidance,
  parseStructuredOutput,
  type StructuredRepairRequest,
} from "./structured-output";

const schema = z
  .object({
    required: z.string(),
    templateId: z.literal("kinetic"),
    chart: z.object({ value: z.number() }).strict(),
  })
  .strict();

describe("bounded structured output", () => {
  it("accepts only a whole object or one explicit JSON fence", () => {
    expect(extractCompleteJSONObject('{"ok":true}')).toEqual({ ok: true });
    expect(extractCompleteJSONObject('```json\n{"ok":true}\n```')).toEqual({
      ok: true,
    });
    expect(() => extractCompleteJSONObject('Here: {"ok":true}')).toThrow(
      "complete JSON object",
    );
    expect(() => extractCompleteJSONObject('```\n{"ok":true}\n```')).toThrow(
      "fenced JSON object",
    );
    expect(() =>
      extractCompleteJSONObject('```json\n{"a":1}\n```\n```json\n{"b":2}\n```'),
    ).toThrow();
    expect(() => extractCompleteJSONObject("[1,2,3]")).toThrow();
  });

  it("validates the unchanged factual object", async () => {
    const original = {
      required: "kept",
      templateId: "kinetic" as const,
      chart: { value: 42 },
    };
    await expect(
      parseStructuredOutput({
        text: JSON.stringify(original),
        schema,
        providerId: "ollama",
        providerLabel: "Ollama",
        modelId: "qwen2.5:7b",
      }),
    ).resolves.toEqual(original);
  });

  it("does not add required fields or change invalid template ids silently", async () => {
    await expect(
      parseStructuredOutput({
        text: JSON.stringify({ templateId: "invented", chart: { value: 42 } }),
        schema,
        providerId: "lm-studio",
        providerLabel: "LM Studio",
        modelId: "qwen2.5-7b-instruct",
      }),
    ).rejects.toThrow("invalid structured output");
  });

  it("allows exactly one observable same-model repair request", async () => {
    const repair = vi.fn(
      async (_request: StructuredRepairRequest) => '{"still":"invalid"}',
    );
    await expect(
      parseStructuredOutput({
        text: "not JSON",
        schema,
        providerId: "ollama",
        providerLabel: "Ollama",
        modelId: "tinyllama:1.1b",
        repair,
      }),
    ).rejects.toThrow("repair was exhausted after one attempt");
    expect(repair).toHaveBeenCalledTimes(1);
    expect(repair.mock.calls[0]![0].system).toContain(
      "Preserve all valid text",
    );
    expect(repair.mock.calls[0]![0].user).toContain("not JSON");
  });

  it("accepts one repaired object only after strict validation", async () => {
    const repair = vi.fn(async () =>
      JSON.stringify({
        required: "restored",
        templateId: "kinetic",
        chart: { value: 42 },
      }),
    );
    await expect(
      parseStructuredOutput({
        text: JSON.stringify({
          required: "restored",
          chart: { value: 42 },
        }),
        schema,
        providerId: "lm-studio",
        providerLabel: "LM Studio",
        modelId: "qwen2.5-7b-instruct",
        repair,
      }),
    ).resolves.toEqual({
      required: "restored",
      templateId: "kinetic",
      chart: { value: 42 },
    });
    expect(repair).toHaveBeenCalledTimes(1);
  });

  it("reports small-model capability guidance clearly", () => {
    expect(localModelCapabilityGuidance("ollama", "tinyllama:1.1b")).toContain(
      "smaller than 7B",
    );
    expect(
      localModelCapabilityGuidance("lm-studio", "qwen2.5-14b-instruct"),
    ).toContain("JSON-schema output");
  });
});
