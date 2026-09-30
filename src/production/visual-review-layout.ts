import { z } from "zod";
import type { ProductionLayout } from "@/production/layout";

const rectSchema = z.object({
  left: z.number().finite(),
  top: z.number().finite(),
  right: z.number().finite(),
  bottom: z.number().finite(),
});
export const layoutEvidenceSchema = z.object({
  frame: z.number().int().nonnegative(),
  checkedTextNodes: z.number().int().min(0).max(512),
  truncated: z.boolean(),
  issues: z
    .array(
      z.object({
        kind: z.enum(["text-clipping", "safe-area"]),
        text: z.string().max(100),
        bounds: rectSchema,
      }),
    )
    .max(8),
});
export type LayoutEvidence = z.infer<typeof layoutEvidenceSchema>;
export const LAYOUT_LOG_PREFIX = "REEL_REVIEW_LAYOUT ";

/** Native DOM measurement only; no mutations, OCR, contrast or taste claims. */
export function measureReviewLayout(
  root: HTMLElement,
  layout: ProductionLayout,
  frame: number,
): LayoutEvidence {
  const origin = root.getBoundingClientRect();
  const scaleX = origin.width / layout.width;
  const scaleY = origin.height / layout.height;
  const result: LayoutEvidence = {
    frame,
    checkedTextNodes: 0,
    truncated: false,
    issues: [],
  };
  if (!scaleX || !scaleY) return result;
  const rect = (r: DOMRect) => ({
    left: (r.left - origin.left) / scaleX,
    right: (r.right - origin.left) / scaleX,
    top: (r.top - origin.top) / scaleY,
    bottom: (r.bottom - origin.top) / scaleY,
  });
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let visited = 0;
  while (walker.nextNode()) {
    if (++visited > 512) {
      result.truncated = true;
      break;
    }
    const node = walker.currentNode;
    const element = node.parentElement;
    if (
      !element?.closest("[data-review-content]") ||
      element.closest('[aria-hidden="true"]') ||
      !node.textContent?.trim()
    )
      continue;
    let opacity = 1;
    let hidden = false;
    for (
      let parent: HTMLElement | null = element;
      parent;
      parent = parent.parentElement
    ) {
      const style = getComputedStyle(parent);
      opacity *= Number(style.opacity);
      if (style.display === "none" || style.visibility !== "visible")
        hidden = true;
      if (parent === root) break;
    }
    // Ignore disappearing/revealing layers, where a mask can be intentional.
    if (hidden || opacity < 0.98) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const boxes = Array.from(range.getClientRects()).filter(
      (r) => r.width > 0 && r.height > 0,
    );
    if (!boxes.length) continue;
    result.checkedTextNodes++;
    const bounds = boxes.map(rect).reduce((a, b) => ({
      left: Math.min(a.left, b.left),
      top: Math.min(a.top, b.top),
      right: Math.max(a.right, b.right),
      bottom: Math.max(a.bottom, b.bottom),
    }));
    let clipped =
      bounds.left < -2 ||
      bounds.top < -2 ||
      bounds.right > layout.width + 2 ||
      bounds.bottom > layout.height + 2;
    for (
      let parent: HTMLElement | null = element;
      parent && parent !== root;
      parent = parent.parentElement
    ) {
      const style = getComputedStyle(parent);
      const clip = rect(parent.getBoundingClientRect());
      if (
        ["hidden", "clip", "scroll", "auto"].includes(style.overflowX) &&
        (bounds.left < clip.left - 2 || bounds.right > clip.right + 2)
      )
        clipped = true;
      if (
        ["hidden", "clip", "scroll", "auto"].includes(style.overflowY) &&
        (bounds.top < clip.top - 2 || bounds.bottom > clip.bottom + 2)
      )
        clipped = true;
    }
    const unsafe =
      bounds.left < layout.safeArea.left - 2 ||
      bounds.right > layout.width - layout.safeArea.right + 2 ||
      bounds.top < layout.safeArea.top - 2 ||
      bounds.bottom > layout.height - layout.safeArea.bottom + 2;
    if ((clipped || unsafe) && result.issues.length < 8)
      result.issues.push({
        kind: clipped ? "text-clipping" : "safe-area",
        text: node.textContent.trim().slice(0, 100),
        bounds,
      });
  }
  return result;
}
