import { z } from "zod";

import { AIError } from "./types";
import type { LocalAIProviderId } from "./local-types";

export interface StructuredRepairRequest {
  system: string;
  user: string;
}

function failureSummary(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues
      .slice(0, 8)
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
  }
  return error instanceof Error ? error.message : String(error);
}

export function extractCompleteJSONObject(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.length > 512_000) {
    throw new Error("Structured output exceeds the 512000-character limit.");
  }
  let candidate = trimmed;
  if (trimmed.startsWith("```")) {
    const match = /^```json[ \t]*\r?\n([\s\S]*?)\r?\n```$/i.exec(trimmed);
    if (!match) {
      throw new Error(
        "Expected exactly one fenced JSON object with no surrounding text.",
      );
    }
    candidate = match[1]!.trim();
  }
  if (!candidate.startsWith("{") || !candidate.endsWith("}")) {
    throw new Error("Expected one complete JSON object.");
  }
  const parsed: unknown = JSON.parse(candidate);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected one complete JSON object.");
  }
  return parsed;
}

export function localModelCapabilityGuidance(
  providerId: LocalAIProviderId,
  modelId: string,
): string {
  const size = /(?:^|[-_: ])(\d+(?:\.\d+)?)b(?:$|[-_: ])/i.exec(modelId);
  if (
    /\b(?:tiny|small|mini)\b/i.test(modelId) ||
    (size && Number(size[1]) < 7)
  ) {
    return `The selected ${providerId} model appears smaller than 7B and may not reliably follow Reel Studio's strict schemas. Choose a 7B+ instruction model with JSON-schema support.`;
  }
  return `The selected ${providerId} model may not support strict JSON-schema output. Choose a current instruction model with tool or structured-output support.`;
}

export async function parseStructuredOutput<T>(input: {
  text: string;
  schema: z.ZodType<T>;
  providerId: LocalAIProviderId;
  providerLabel: string;
  modelId: string;
  repair?: (request: StructuredRepairRequest) => Promise<string>;
}): Promise<T> {
  function parse(text: string): T {
    return input.schema.parse(extractCompleteJSONObject(text));
  }

  let firstError: unknown;
  try {
    return parse(input.text);
  } catch (error) {
    firstError = error;
  }

  if (!input.repair) {
    throw new AIError(
      `${input.providerLabel} returned invalid structured output: ${failureSummary(firstError)}. ${localModelCapabilityGuidance(input.providerId, input.modelId)}`,
      502,
      input.providerId,
    );
  }

  const repairText = await input.repair({
    system:
      "Repair one JSON object so it validates against the supplied response schema. Return only the complete JSON object. Preserve all valid text, factual values, chart labels and values, and already-valid template IDs. Do not invent missing facts.",
    user: `The previous response failed validation: ${failureSummary(firstError)}\n\nPrevious response:\n${input.text}\n\nReturn a corrected complete object that follows the response schema exactly.`,
  });
  try {
    return parse(repairText);
  } catch (repairError) {
    throw new AIError(
      `${input.providerLabel} structured-output repair was exhausted after one attempt: ${failureSummary(repairError)}. ${localModelCapabilityGuidance(input.providerId, input.modelId)}`,
      502,
      input.providerId,
    );
  }
}
