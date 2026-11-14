/**
 * The whole scene library in one list: the registered scene types plus the
 * nine core types the engine has always had. The /scenes page, the tests and
 * the docs read this, so a new scene type shows up everywhere from its folder.
 */
import type { ReelScene } from "@/video/types";
import { SCENE_DEFINITIONS } from "./registry";
import type { SceneFormat } from "./types";

export interface SceneLibraryEntry {
  /** Storyboard scene type. */
  type: string;
  templateId: string;
  name: string;
  description: string;
  /** Registered types carry per-format layout notes. */
  layout?: Record<SceneFormat, string>;
  /** A complete sample scene the player can render. */
  scene: ReelScene;
}

const core = (
  type: string,
  templateId: string,
  name: string,
  description: string,
  scene: Partial<ReelScene> & { text: string },
): SceneLibraryEntry => ({
  type,
  templateId,
  name,
  description,
  scene: { id: `sample-${type}`, templateId, emphasis: [], ...scene },
});

const CORE: SceneLibraryEntry[] = [
  core("hook", "hf-opener", "Hook", "Opening line that grabs attention.", {
    text: "Stop scrolling. This is the part that matters.",
    emphasis: ["matters"],
  }),
  core("statement", "hf-statement", "Statement", "One key idea, large.", {
    text: "Clarity beats cleverness every single time.",
    emphasis: ["Clarity"],
  }),
  core("list", "hf-list", "List", "Two to six short points.", {
    text: "Before you ship",
    items: ["Write the goal", "Pick the context", "Ship the draft"],
  }),
  core("stat", "hf-stat", "Stat", "One big number with its meaning.", {
    text: "Teams that ship weekly grow twice as fast.",
    emphasis: ["twice as fast"],
    visual: "2×",
  }),
  core(
    "chart",
    "hf-data-chart",
    "Chart",
    "Bars, a line or a donut from real values.",
    {
      text: "Completion by stage.",
      visual: "Completion by stage",
      chart: {
        labels: ["Draft", "Review", "Release"],
        series: [
          { label: "Illustrative values", values: [42, 68, 91], unit: "%" },
        ],
        sourceAttribution: "Demo data, illustrative only",
      },
    },
  ),
  core("quote", "hf-quote", "Quote", "A real, attributed quotation.", {
    text: "The best prompt is the one you actually use.",
    emphasis: ["actually use"],
    visual: "AI Weekly",
  }),
  core(
    "code",
    "hf-statement",
    "Code",
    "A short snippet set as a bold statement.",
    {
      text: "const wait = debounce(search, 300);",
    },
  ),
  core(
    "media",
    "hf-broll",
    "Media",
    "A full-frame picture or clip with a lower third.",
    {
      text: "Show the idea in motion, then let one clear line land.",
      emphasis: ["one clear line"],
    },
  ),
  core("cta", "hf-cta", "Call to action", "The closing ask.", {
    text: "Follow for the next breakdown.",
    emphasis: ["Follow"],
    visual: "Subscribe",
  }),
];

export function sceneLibrary(): SceneLibraryEntry[] {
  const registered = SCENE_DEFINITIONS.map((definition): SceneLibraryEntry => ({
    type: definition.id,
    templateId: definition.templateId,
    name: definition.name,
    description: definition.description,
    layout: definition.layout,
    scene: {
      id: `sample-${definition.id}`,
      templateId: definition.templateId,
      text: definition.sample.headline,
      spokenText: definition.sample.narration,
      emphasis: definition.sample.emphasis ?? [],
      panel: definition.sample.payload as Record<string, unknown>,
    },
  }));
  return [...CORE, ...registered];
}
