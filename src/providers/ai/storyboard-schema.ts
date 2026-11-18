/**
 * Storyboard v1 as a structured-output schema every provider accepts. The
 * published JSON Schema keeps every limit; providers differ in which keywords
 * they allow, so this view keeps the shape, the enums and the descriptions
 * (which state each limit and an example) and drops constraint keywords.
 * Limits are enforced afterwards by the storyboard linter, not by the provider.
 */
import { storyboardJsonSchema } from "@/storyboard";

import { strictOutputSchema } from "./director-schema";

const DROPPED = new Set([
  "$schema",
  "$id",
  "title",
  "default",
  "pattern",
  "format",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "additionalProperties",
]);

type Node = Record<string, unknown>;

function simplify(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(simplify);
  if (!node || typeof node !== "object") return node;
  const input = node as Node;
  // A union of plain strings (for example "auto" | "none" | a track id) is one string.
  if (
    Array.isArray(input.anyOf) &&
    input.anyOf.every((branch) => (branch as Node).type === "string")
  ) {
    return {
      type: "string",
      ...(input.description ? { description: input.description } : {}),
    };
  }
  const out: Node = {};
  for (const [key, value] of Object.entries(input)) {
    if (DROPPED.has(key)) continue;
    if (key === "const") {
      out.enum = [value];
      continue;
    }
    if (key === "properties" && value && typeof value === "object") {
      out.properties = Object.fromEntries(
        Object.entries(value as Node).map(([k, v]) => [k, simplify(v)]),
      );
      continue;
    }
    out[key] = simplify(value);
  }
  return out;
}

export type StoryboardKind = "video" | "podcast";

/** The video or podcast storyboard, in the plain subset every provider supports. */
export function storyboardWriterSchema(kind: StoryboardKind = "video"): Node {
  const full = storyboardJsonSchema() as { anyOf: Node[] };
  const variant = full.anyOf[kind === "podcast" ? 1 : 0]!;
  return simplify({ ...variant, type: "object" }) as Node;
}

/** Gemini `responseJsonSchema`. */
export function geminiStoryboardSchema(kind: StoryboardKind = "video"): Node {
  return storyboardWriterSchema(kind);
}

/** OpenAI, LM Studio, llama.cpp and Ollama `json_schema` / `format` wrapper. */
export function strictStoryboardSchema(kind: StoryboardKind = "video"): {
  name: string;
  strict: true;
  schema: Node;
} {
  return {
    name: "storyboard",
    strict: true,
    schema: strictOutputSchema({
      ...storyboardWriterSchema(kind),
      additionalProperties: false,
    }) as Node,
  };
}
