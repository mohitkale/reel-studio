import { sceneConfigSchema } from "@/library/schemas";
import type { VisualReviewFinding } from "./visual-review-findings";

/** One conservative visual repair: use measured complete text on an opaque
 * surface. Preserve copy, narration, assets, numeric data, timing and locks. */
export function planDirectorRepair(
  scene: {
    id: string;
    text: string;
    visual: string | null;
    hideText: boolean | null;
    layoutJson: string | null;
  },
  findings: readonly VisualReviewFinding[],
) {
  let config;
  try {
    config = sceneConfigSchema.parse(JSON.parse(scene.layoutJson ?? "{}"));
  } catch {
    return null;
  }
  if (
    config.locks?.scene ||
    scene.hideText ||
    !scene.text.trim() ||
    scene.text.length > 240 ||
    scene.visual ||
    config.background ||
    config.chart ||
    config.items?.length ||
    !findings.some(
      (finding) =>
        finding.sceneId === scene.id &&
        ["fallback", "text-clipping", "safe-area", "contrast"].includes(
          finding.kind,
        ),
    )
  )
    return null;
  if (config.direction?.composition === "layered-title") return null;
  return {
    ...config,
    motion: undefined,
    direction: {
      version: 1 as const,
      role: config.role ?? ("explanation" as const),
      composition: "layered-title" as const,
    },
  };
}
