import type { AIScene } from "@/providers/ai/types";
import type { VideoEngineId } from "@/engines/types";

/** Map Remotion-oriented AI template picks onto the HyperFrames catalog. */
const REMOTION_TO_HF: Record<string, string> = {
  kinetic: "hf-statement",
  lottie: "hf-statement",
  three: "hf-opener",
  "stat-reveal": "hf-stat",
  "icon-grid": "hf-list",
  "quote-card": "hf-quote",
  "emoji-punch": "hf-opener",
};

/**
 * AI providers emit Remotion template ids (stable schema). For HyperFrames
 * projects, remap to the HF-native catalog and force opener/CTA bookends.
 */
export function mapScenesToEngineTemplates(
  scenes: AIScene[],
  engine: VideoEngineId,
): AIScene[] {
  if (engine !== "hyperframes") return scenes;

  return scenes.map((scene, index) => {
    let templateId =
      REMOTION_TO_HF[scene.templateId] ??
      (scene.templateId.startsWith("hf-") ? scene.templateId : "hf-statement");
    if (index === 0) templateId = "hf-opener";
    if (index === scenes.length - 1 && scenes.length > 1) templateId = "hf-cta";
    return {
      ...scene,
      templateId: templateId as AIScene["templateId"],
    };
  });
}
