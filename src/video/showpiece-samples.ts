import type { ReelScene } from "./types";
import type { SemanticGraphic, ShowpieceId } from "./semantic-graphic";

/** Explicitly illustrative sample copy; never provider/product evidence. */
const samples: Array<{
  id: ShowpieceId;
  text: string;
  spokenText: string;
  graphic: SemanticGraphic;
}> = [
  {
    id: "depth-focus",
    text: "An agent keeps working in the cloud.",
    spokenText: "An agent uses a cloud computer to keep working.",
    graphic: {
      version: 1,
      kind: "concept",
      nodes: [
        { label: "agent", detail: "uses a cloud computer", symbol: "agent" },
      ],
    },
  },
  {
    id: "orbital-comparison",
    text: "Search, Answers and Sources.",
    spokenText:
      "Compare Search, Answers and Sources: three different ways to discover information.",
    graphic: {
      version: 1,
      kind: "comparison",
      nodes: [
        { label: "Search", symbol: "search" },
        { label: "Answers", symbol: "answer" },
        { label: "Sources", symbol: "sources" },
      ],
    },
  },
  {
    id: "branch-cascade",
    text: "One owner becomes a team.",
    spokenText: "The CEO hires CTO, COO, CMO and CXO.",
    graphic: {
      version: 1,
      kind: "hierarchy",
      nodes: [
        { label: "CEO", symbol: "person" },
        ...["CTO", "COO", "CMO", "CXO"].map((label) => ({
          label,
          symbol: "person" as const,
          parent: 0,
        })),
      ],
    },
  },
  {
    id: "signal-routing",
    text: "A shared API connects the system.",
    spokenText: "API connects Phone, Website, Database and Cloud.",
    graphic: {
      version: 1,
      kind: "system",
      nodes: [
        { label: "API", symbol: "code" },
        { label: "Phone", symbol: "device" },
        { label: "Website", symbol: "document" },
        { label: "Database", symbol: "code" },
        { label: "Cloud", symbol: "cloud" },
      ],
    },
  },
  {
    id: "kinetic-handoff",
    text: "Work moves between owners.",
    spokenText: "First Designer, then Reviewer, finally DevOps.",
    graphic: {
      version: 1,
      kind: "flow",
      nodes: [
        { label: "Designer", symbol: "person" },
        { label: "Reviewer", symbol: "person" },
        { label: "DevOps", symbol: "person" },
      ],
    },
  },
  {
    id: "device-evolution",
    text: "One app, three deliberate stages.",
    spokenText: "The app moves from Wireframe to Prototype to Launch.",
    graphic: {
      version: 1,
      kind: "flow",
      nodes: [
        { label: "Wireframe", symbol: "device" },
        { label: "Prototype", symbol: "device" },
        { label: "Launch", symbol: "none" },
      ],
    },
  },
  {
    id: "lunar-cycle",
    text: "Track moon phases for intention setting.",
    spokenText: "Track the moon phases to set intentions.",
    graphic: {
      version: 1,
      kind: "concept",
      nodes: [{ label: "moon phases", symbol: "moon" }],
    },
  },
  {
    id: "year-cycle",
    text: "Understand the Wheel of the Year's cycles.",
    spokenText: "Understand the Wheel of the Year's ancient cycles.",
    graphic: {
      version: 1,
      kind: "concept",
      nodes: [{ label: "Wheel of the Year", symbol: "cycle" }],
    },
  },
  {
    id: "sky-orbit",
    text: "Align your life with celestial rhythms.",
    spokenText:
      "Imagine aligning your life with the natural rhythms of the cosmos.",
    graphic: {
      version: 1,
      kind: "concept",
      nodes: [{ label: "celestial rhythms", symbol: "orbit" }],
    },
  },
];
export const SHOWPIECE_SAMPLES: ReelScene[] = samples.map((sample, order) => ({
  id: `showpiece-${sample.id}`,
  templateId: "hf-statement",
  text: sample.text,
  spokenText: sample.spokenText,
  emphasis: [],
  order,
  direction: {
    version: 1,
    role:
      sample.graphic.kind === "concept"
        ? "explanation"
        : sample.graphic.kind === "comparison"
          ? "comparison"
          : "diagram",
    composition: "authored",
    graphic: { ...sample.graphic, presentation: sample.id },
  },
}));
