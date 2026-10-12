/** New authored blocks register data here; schemas and editor options derive IDs. */
export const EXTENSION_MOTION_RECIPES = [
  {
    id: "quote-margin",
    name: "Margin quote",
    description:
      "Supplied quotation appears beside a large opening mark and a restrained rule.",
    maxCharacters: 140,
    content: "text",
    roles: ["quote"],
    anchors: { reveal: 0.22 },
  },
  {
    id: "type-spread",
    name: "Editorial spread",
    description:
      "Asymmetric columns open around a supplied emphasis phrase, with a measured reading hold.",
    maxCharacters: 200,
    content: "text",
    roles: ["headline", "explanation", "summary", "takeaway"],
    anchors: { reveal: 0.24 },
  },
  {
    id: "type-poster",
    name: "Colour-field poster",
    description:
      "A full-colour inset field unfolds behind oversized supplied copy and a precise closing rule.",
    maxCharacters: 100,
    content: "text",
    roles: ["hook", "emphasis", "payoff", "headline"],
    anchors: { reveal: 0.24, impact: 0.62 },
  },
  {
    id: "type-window",
    name: "Focus window",
    description:
      "Opposing shutters open a framed reading window; corner marks settle around the message.",
    maxCharacters: 180,
    content: "text",
    roles: ["hook", "headline", "feature", "explanation", "takeaway"],
    anchors: { reveal: 0.24 },
  },
  {
    id: "list-cascade",
    name: "Cascading list",
    description:
      "Two to five supplied ideas assemble into offset numbered rows in their original order.",
    maxCharacters: 100,
    content: "list",
    roles: ["tip", "feature", "summary", "diagram"],
    anchors: { reveal: 0.2 },
  },
  {
    id: "list-grid",
    name: "Tile grid",
    description:
      "Two to four ideas assemble as a spacious indexed grid, with alternating entrances and a steady reading hold.",
    maxCharacters: 100,
    content: "list",
    roles: ["tip", "feature", "summary", "diagram"],
    anchors: { reveal: 0.2 },
  },
  {
    id: "data-ledger",
    name: "Metric ledger",
    description:
      "Exact supplied values and labels land in a ruled ledger, with source attribution kept visible.",
    maxCharacters: 110,
    content: "data",
    roles: ["chart", "comparison", "metric"],
    anchors: { reveal: 0.2 },
  },
  {
    id: "media-mat",
    name: "Gallery mat",
    description:
      "A supplied image settles inside an offset gallery mat with an uncropped image and a separate headline.",
    maxCharacters: 100,
    content: "image",
    roles: ["hero", "feature", "screenshot-demo"],
    anchors: { reveal: 0.24 },
  },
] as const;
