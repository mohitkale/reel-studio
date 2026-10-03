/** New authored blocks register data here; schemas and editor options derive IDs. */
export const EXTENSION_MOTION_RECIPES = [
  {
    id: "quote-margin",
    name: "Margin quote",
    description:
      "Supplied quotation appears beside a large opening mark and a restrained rule.",
    maxCharacters: 140,
    roles: ["quote"],
    anchors: { reveal: 0.22 },
  },
] as const;
