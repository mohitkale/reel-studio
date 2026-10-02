import type { AIScene } from "@/providers/ai/types";
import type { VideoEngineId } from "@/engines/types";
import { normalizeHfTemplateId } from "./templates";
/** Normalize legacy AI plan ids onto the supported HTML catalog. */
export function mapScenesToEngineTemplates(
  scenes: AIScene[],
  _engine: VideoEngineId,
): AIScene[] {
  void _engine;
  return scenes.map((scene) => ({
    ...scene,
    templateId: normalizeHfTemplateId(
      scene.templateId,
    ) as AIScene["templateId"],
  }));
}
