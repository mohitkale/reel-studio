/**
 * Pasting a storyboard from any chat assistant (roadmap U7): find the JSON in a
 * reply that may be wrapped in prose or code fences, and turn lint errors into
 * a short message to paste back. Pure and tested.
 */
import { lintStoryboard, type LintResult } from "@/storyboard";

export type Extracted =
  { ok: true; value: unknown } | { ok: false; reason: string };

/** The first balanced `{ ... }` in the text, honouring strings and escapes. */
function balancedObject(text: string, from: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = from; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(from, i + 1);
    }
  }
  return null;
}

function tryParse(text: string): unknown | undefined {
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

/** Pull one JSON object out of a chat reply. */
export function extractJson(reply: string): Extracted {
  const text = reply.trim();
  if (!text) return { ok: false, reason: "Nothing was pasted yet." };
  const whole = tryParse(text);
  if (whole) return { ok: true, value: whole };
  // Code fences first: ```json ... ``` (or plain ```).
  for (const match of text.matchAll(/```(?:json|JSON)?\s*([\s\S]*?)```/g)) {
    const value = tryParse(match[1]!.trim());
    if (value) return { ok: true, value };
    const start = match[1]!.indexOf("{");
    if (start >= 0) {
      const inner = balancedObject(match[1]!, start);
      const parsed = inner ? tryParse(inner) : undefined;
      if (parsed) return { ok: true, value: parsed };
    }
  }
  // Then every `{` in the prose, first object that parses wins.
  for (let i = text.indexOf("{"); i >= 0; i = text.indexOf("{", i + 1)) {
    const candidate = balancedObject(text, i);
    const value = candidate ? tryParse(candidate) : undefined;
    if (value) return { ok: true, value };
  }
  return {
    ok: false,
    reason:
      "No JSON object was found in the pasted text. Ask the assistant to reply with the storyboard JSON only.",
  };
}

export interface PasteResult {
  extracted: Extracted;
  lint?: LintResult;
}

export function checkPasted(reply: string): PasteResult {
  const extracted = extractJson(reply);
  return extracted.ok
    ? { extracted, lint: lintStoryboard(extracted.value) }
    : { extracted };
}

/** A short message to paste back into the chat when the reply had errors. */
export function buildFixRequest(
  result: PasteResult | Pick<LintResult, "errors">,
): string {
  const errors =
    "errors" in result ? result.errors : (result.lint?.errors ?? []);
  if (!errors.length && "extracted" in result && !result.extracted.ok)
    return `${result.extracted.reason} Reply with the complete storyboard as one JSON object and nothing else.`;
  const lines = errors.map(
    (e) =>
      `- ${e.path || "storyboard"}: ${e.message}. Expected ${e.expected}, for example ${e.example}.`,
  );
  return `The storyboard JSON has problems:\n${lines.join("\n")}\n\nReply with the complete corrected JSON object only, no other text.`;
}
