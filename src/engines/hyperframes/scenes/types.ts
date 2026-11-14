/**
 * Scene type registry contract (roadmap V3).
 *
 * A scene type is one folder under `src/engines/hyperframes/scenes/<type>/`
 * exporting a `SceneDefinition`: the payload `schema`, how it fills each
 * format (`layout`), the HTML `build`, and a `sample` that the /scenes page and
 * the tests render. Registering a type is the folder plus one line in
 * `registry.ts`; nothing else in the engine needs to know its name.
 */
import type { z } from "zod";
import type { ProductionSceneRole } from "@/production/roles";

export type SceneFormat = "9:16" | "16:9" | "1:1";

/** What the engine hands a scene when it builds its markup. */
export interface SceneKit {
  /** On-screen headline for the scene (already plain text). */
  text: string;
  emphasis: string[];
  /** Text colour and accent for this scene's palette. */
  ink: string;
  accent: string;
  /** Readable text colour on top of the accent (dark or white). */
  onAccent: string;
  /** Speaker/role chip markup, empty when there is none. */
  chip: string;
  /** Framed picture for scenes that show media inside the panel, if any. */
  mediaUrl?: string;
  escape(value: string): string;
  emphasize(text: string, emphasis: string[]): string;
  lineStack(
    text: string,
    emphasis: string[],
    maxChars: number,
    lineClass?: string,
    maxWordsPerLine?: number,
  ): string;
}

export interface SceneDefinition<Payload = unknown> {
  /** Storyboard scene type, for example "steps". */
  id: string;
  /** HyperFrames treatment id the project stores, for example "hf-steps". */
  templateId: string;
  name: string;
  description: string;
  /** Engine-neutral purpose, used by the motion director and the exporter. */
  role: ProductionSceneRole;
  /** Backdrop recipe from the native stage shells. */
  recipe: string;
  /**
   * The picture is drawn inside the panel; the full-bleed background layer is
   * left out for still images.
   */
  framedMedia?: boolean;
  /**
   * The panel is filled by one block (a terminal window, a framed picture), so
   * the engine does not grow or shrink its text to fit.
   */
  fixedFill?: boolean;
  /** The scene is already a visual (cards, rail, boxes), so no icon badge is added. */
  ownVisual?: boolean;
  /** Shape of the data a storyboard supplies; invalid data degrades to a statement. */
  schema: z.ZodType<Payload>;
  /** How the scene uses the content region in each format. */
  layout: Record<SceneFormat, string>;
  /** Markup inside the panel (`.fx-dialogue`). */
  build(payload: Payload, kit: SceneKit): string;
  sample: {
    headline: string;
    narration: string;
    emphasis?: string[];
    payload: Payload;
  };
}
