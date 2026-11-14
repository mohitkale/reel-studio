/**
 * The scene registry. Adding a scene type is one folder plus one line here.
 */
import type { SceneDefinition } from "./types";
import { beforeAfter } from "./before-after";
import { checklist } from "./checklist";
import { comparison } from "./comparison";
import { definition } from "./definition";
import { deviceMockup } from "./device-mockup";
import { diagram } from "./diagram";
import { kineticText } from "./kinetic-text";
import { mediaSplit } from "./media-split";
import { steps } from "./steps";
import { terminal } from "./terminal";
import { timeline } from "./timeline";

export const SCENE_DEFINITIONS: ReadonlyArray<SceneDefinition<never>> = [
  kineticText,
  steps,
  checklist,
  comparison,
  beforeAfter,
  timeline,
  definition,
  terminal,
  diagram,
  mediaSplit,
  deviceMockup,
] as unknown as ReadonlyArray<SceneDefinition<never>>;

const BY_TEMPLATE = new Map(SCENE_DEFINITIONS.map((d) => [d.templateId, d]));
const BY_TYPE = new Map(SCENE_DEFINITIONS.map((d) => [d.id, d]));

export function sceneDefinitionForTemplate(
  templateId: string | undefined,
): SceneDefinition<unknown> | undefined {
  return templateId
    ? (BY_TEMPLATE.get(templateId) as SceneDefinition<unknown> | undefined)
    : undefined;
}

export function sceneDefinitionForType(
  type: string,
): SceneDefinition<unknown> | undefined {
  return BY_TYPE.get(type) as SceneDefinition<unknown> | undefined;
}
