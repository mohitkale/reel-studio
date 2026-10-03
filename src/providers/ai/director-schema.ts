/** Small common JSON subset for frontier/local structured output. Zod admission
 * and factual input checks remain authoritative after provider parsing. */
export const SHOT_DIRECTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    version: { type: "integer", enum: [1] },
    role: { type: "string" },
    composition: { type: "string", enum: ["authored", "layered-title"] },
    motion: {
      type: "object",
      additionalProperties: false,
      properties: {
        recipeId: { type: "string" },
        version: { type: "string", enum: ["1.0.0"] },
      },
      required: ["recipeId", "version"],
    },
  },
  required: ["version", "role", "composition"],
};

export const CHART_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    labels: { type: "array", items: { type: "string" } },
    series: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          values: { type: "array", items: { type: "number" } },
          unit: { type: "string" },
        },
        required: ["label", "values"],
      },
    },
    sourceAttribution: { type: "string" },
  },
  required: ["labels", "series"],
};

/** Strict structured output requires EVERY property, with null for absent
 * optional fields. Keep a permissive subset for Gemini/local model support. */
export function strictOutputSchema(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...schema };
  if (
    schema.type === "object" &&
    schema.properties &&
    typeof schema.properties === "object"
  ) {
    const required = new Set(
      Array.isArray(schema.required) ? schema.required : [],
    );
    const properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => {
        const child = strictOutputSchema(value as Record<string, unknown>);
        return [
          key,
          required.has(key) ? child : { anyOf: [child, { type: "null" }] },
        ];
      }),
    );
    result.properties = properties;
    result.required = Object.keys(properties);
    result.additionalProperties = false;
  }
  if (schema.items && typeof schema.items === "object")
    result.items = strictOutputSchema(schema.items as Record<string, unknown>);
  return result;
}

const optional = new Set([
  "direction",
  "motion",
  "spokenText",
  "visual",
  "items",
  "chart",
  "backgroundQuery",
  "mediaKind",
  "effect",
  "mood",
  "musicMood",
  "unit",
  "sourceAttribution",
]);
/** Normalize ONLY named optional fields; preserve unknown fields for rejection. */
export function normalizeOptionalPlanFields(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(normalizeOptionalPlanFields);
  if (!input || typeof input !== "object") return input;
  return Object.fromEntries(
    Object.entries(input)
      .filter(([key, value]) => value !== null || !optional.has(key))
      .map(([key, value]) => [key, normalizeOptionalPlanFields(value)]),
  );
}
