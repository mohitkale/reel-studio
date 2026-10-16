import { adaptiveRecipeManifestSchema } from "./adaptive-recipe";

/** Bundled v1 recipes. Changing their rendering requires a new recipe version. */
export const ADAPTIVE_RECIPES = [
  {
    id: "adaptive-concept",
    name: "Concept focus",
    description: "A supplied idea opens into a focused reading canvas.",
    maxCharacters: 260,
    intent: "explanation",
    input: "text",
  },
  {
    id: "adaptive-comparison",
    name: "Adaptive comparison",
    description:
      "Two to four supplied alternatives reflow into panels or a comparison grid.",
    maxCharacters: 180,
    intent: "comparison",
    input: "subjects",
  },
  {
    id: "adaptive-process",
    name: "Progressive process",
    description:
      "Two to six explicit steps form a horizontal route or a vertical sequence.",
    maxCharacters: 180,
    intent: "process",
    input: "ordered-steps",
  },
  {
    id: "adaptive-evidence",
    name: "Evidence ledger",
    description:
      "Exact supplied values become a metric, ledger or measured bars.",
    maxCharacters: 180,
    intent: "evidence",
    input: "chart",
  },
  {
    id: "adaptive-media",
    name: "Media study",
    description:
      "A supplied image keeps its full frame beside an adaptive caption.",
    maxCharacters: 260,
    intent: "media",
    input: "media-reference",
  },
  {
    id: "adaptive-editorial",
    name: "Editorial reading",
    description:
      "Complete supplied copy receives a measured typographic reveal and reading hold.",
    maxCharacters: 600,
    intent: "explanation",
    input: "text",
  },
] as const;
export type AdaptiveRecipeId = (typeof ADAPTIVE_RECIPES)[number]["id"];
export function isAdaptiveRecipe(
  id: string | undefined,
): id is AdaptiveRecipeId {
  return ADAPTIVE_RECIPES.some((recipe) => recipe.id === id);
}
export const ADAPTIVE_MANIFESTS = ADAPTIVE_RECIPES.map((recipe) =>
  adaptiveRecipeManifestSchema.parse({
    schemaVersion: 1,
    id: recipe.id,
    version: "1.0.0",
    name: recipe.name,
    mode: "adaptive",
    intents: [recipe.intent],
    inputs: [{ name: "content", kind: recipe.input, required: true }],
    durationSeconds: { min: 1, max: 120 },
    density: {
      characters: { min: 1, max: recipe.maxCharacters },
      subjects: {
        min:
          recipe.input === "subjects" || recipe.input === "ordered-steps"
            ? 2
            : 1,
        max:
          recipe.input === "subjects"
            ? 4
            : recipe.input === "ordered-steps" || recipe.input === "chart"
              ? 6
              : 1,
      },
    },
    aspects: [
      { format: "portrait", strategy: "stack" },
      { format: "landscape", strategy: "reflow" },
      { format: "square", strategy: "stage" },
    ],
    tokenSlots: [
      "background",
      "foreground",
      "accent",
      "accentSecondary",
      "fontFamily",
      "radius",
    ],
    events: [
      { id: "establish", phase: "establish" },
      { id: "reveal", phase: "reveal" },
      { id: "focus", phase: "emphasize" },
      { id: "hold", phase: "resolve" },
    ],
    continuityPorts: [],
    resourceClass: "light",
    fallback: [{ id: "saved-scene", version: "1.0.0" }],
    provenance: {
      origin: "bundled",
      license: "MIT",
      revision: "adaptive-recipes-1",
    },
    fixtureIds: [
      "sparse",
      "dense",
      "short",
      "long",
      "missing-media",
      "portrait",
      "landscape",
      "square",
    ],
  }),
);
