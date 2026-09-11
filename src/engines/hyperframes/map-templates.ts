import type { AIScene } from "@/providers/ai/types";
import type { VideoEngineId } from "@/engines/types";

/**
 * Map Remotion-oriented AI template picks onto the HyperFrames catalog.
 * Prefers curated upstream registry blocks for production-grade ads.
 */
const REMOTION_TO_HF: Record<string, string> = {
  kinetic: "hf-kinetic-slam",
  lottie: "hf-app-showcase",
  three: "hf-app-showcase",
  "stat-reveal": "hf-money-count",
  "icon-grid": "hf-list",
  "quote-card": "hf-quote",
  "emoji-punch": "hf-kinetic-slam",
};

/**
 * Normalize scenes onto the target engine catalog.
 * When the model already emits `hf-*` ids, keep them.
 * Legacy Remotion ids still remap for older prompts / mixed plans.
 */
export function mapScenesToEngineTemplates(
  scenes: AIScene[],
  engine: VideoEngineId,
): AIScene[] {
  if (engine !== "hyperframes") return scenes;

  return scenes.map((scene) => {
    const templateId = scene.templateId.startsWith("hf-")
      ? scene.templateId
      : (REMOTION_TO_HF[scene.templateId] ?? "hf-statement");
    return {
      ...scene,
      templateId: templateId as AIScene["templateId"],
    };
  });
}
