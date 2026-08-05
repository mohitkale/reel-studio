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
    if (index === 0) templateId = "hf-kinetic-slam";
    if (index === scenes.length - 1 && scenes.length > 1) {
      // Portrait social CTA when the model asked for emoji punch; else logo outro.
      templateId =
        scene.templateId === "emoji-punch" ? "hf-ig-follow" : "hf-logo-outro";
    }
    return {
      ...scene,
      templateId: templateId as AIScene["templateId"],
    };
  });
}
