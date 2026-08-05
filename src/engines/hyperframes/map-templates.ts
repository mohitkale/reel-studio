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

const SOCIAL_CTAS = new Set([
  "hf-ig-follow",
  "hf-tt-follow",
  "hf-logo-outro",
  "hf-cta",
]);

/**
 * Normalize scenes onto the target engine catalog.
 * When the model already emits `hf-*` ids, keep them (with opener/CTA bookends).
 * Legacy Remotion ids still remap for older prompts / mixed plans.
 */
export function mapScenesToEngineTemplates(
  scenes: AIScene[],
  engine: VideoEngineId,
): AIScene[] {
  if (engine !== "hyperframes") return scenes;

  return scenes.map((scene, index) => {
    let templateId = scene.templateId.startsWith("hf-")
      ? scene.templateId
      : (REMOTION_TO_HF[scene.templateId] ?? "hf-statement");

    if (index === 0) templateId = "hf-kinetic-slam";
    if (index === scenes.length - 1 && scenes.length > 1) {
      if (!SOCIAL_CTAS.has(templateId)) {
        templateId =
          scene.templateId === "emoji-punch" ||
          scene.templateId === "hf-ig-follow"
            ? "hf-ig-follow"
            : scene.templateId === "hf-tt-follow"
              ? "hf-tt-follow"
              : "hf-logo-outro";
      }
    }
    return {
      ...scene,
      templateId: templateId as AIScene["templateId"],
    };
  });
}
