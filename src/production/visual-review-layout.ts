import { z } from "zod";
import type { ProductionLayout } from "@/production/layout";

export const rectSchema = z.object({
  left: z.number().finite(),
  top: z.number().finite(),
  right: z.number().finite(),
  bottom: z.number().finite(),
});
export const layoutEvidenceSchema = z.object({
  frame: z.number().int().nonnegative(),
  checkedTextNodes: z.number().int().min(0).max(512),
  truncated: z.boolean(),
  contrastSamples: z
    .array(
      z.object({
        text: z.string().max(100),
        bounds: z.array(rectSchema).min(1).max(16),
        color: z.tuple([
          z.number().min(0).max(255),
          z.number().min(0).max(255),
          z.number().min(0).max(255),
        ]),
        minimumRatio: z.union([z.literal(3), z.literal(4.5)]),
      }),
    )
    .max(32)
    .optional(),
  contrastCheckedTextNodes: z.number().int().min(0).max(32).optional(),
  issues: z
    .array(
      z.object({
        kind: z.enum(["text-clipping", "safe-area", "contrast"]),
        text: z.string().max(100),
        bounds: rectSchema,
        contrastRatio: z.number().finite().nonnegative().optional(),
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
  contentSelector = "[data-review-content]",
): LayoutEvidence {
  const origin = root.getBoundingClientRect();
  const scaleX = origin.width / layout.width;
  const scaleY = origin.height / layout.height;
  const result: LayoutEvidence = {
    frame,
    checkedTextNodes: 0,
    truncated: false,
    issues: [],
    contrastSamples: [],
  };
  if (!scaleX || !scaleY) return result;
  const rect = (r: DOMRect) => ({
    left: (r.left - origin.left) / scaleX,
    right: (r.right - origin.left) / scaleX,
    top: (r.top - origin.top) / scaleY,
    bottom: (r.bottom - origin.top) / scaleY,
  });
  const context =
    typeof CanvasRenderingContext2D !== "undefined"
      ? document.createElement("canvas").getContext("2d")
      : null;
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
        const element = node as HTMLElement;
        if (element.tagName === "SCRIPT" || element.tagName === "STYLE")
          return NodeFilter.FILTER_REJECT;
        const style = getComputedStyle(element);
        // HyperFrames retains inactive scenes in the DOM. Prune them so a late
        // chapter's visible copy still gets the full bounded measurement budget.
        if (
          style.display === "none" ||
          style.visibility !== "visible" ||
          Number(style.opacity) < 0.98
        )
          return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_SKIP;
      },
    },
  );
  let visited = 0;
  while (walker.nextNode()) {
    if (++visited > 512) {
      result.truncated = true;
      break;
    }
    const node = walker.currentNode;
    const element = node.parentElement;
    if (
      !element?.closest(contentSelector) ||
      element.closest('[aria-hidden="true"]') ||
      !node.textContent?.trim()
    )
      continue;
    let opacity = 1;
    let hidden = false;
    let complexPaint = false;
    for (
      let parent: HTMLElement | null = element;
      parent;
      parent = parent.parentElement
    ) {
      const style = getComputedStyle(parent);
      opacity *= Number(style.opacity);
      if (
        (style.filter && style.filter !== "none") ||
        (style.mixBlendMode && style.mixBlendMode !== "normal")
      )
        complexPaint = true;
      if (style.display === "none" || style.visibility !== "visible")
        hidden = true;
      if (parent === root) break;
    }
    // Ignore disappearing/revealing layers, where a mask can be intentional.
    if (hidden || opacity < 0.98) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const paint = getComputedStyle(element);
    let boxes = Array.from(range.getClientRects()).filter(
      (r) => r.width > 0 && r.height > 0,
    );
    // Range rectangles include unused font ascent/descent. Measure native glyph
    // ink before flagging vertical masks, so normal tight line-height stays quiet.
    if (context && paint.fontSize && paint.fontFamily) {
      context.font = `${paint.fontStyle || "normal"} ${paint.fontWeight || "400"} ${paint.fontSize} ${paint.fontFamily}`;
      const text =
        paint.textTransform === "uppercase"
          ? node.textContent.toUpperCase()
          : node.textContent;
      const metrics = context.measureText(text);
      const fontHeight =
        metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
      if (
        Number.isFinite(fontHeight) &&
        fontHeight > 0 &&
        Number.isFinite(metrics.actualBoundingBoxAscent) &&
        Number.isFinite(metrics.actualBoundingBoxDescent)
      ) {
        boxes = boxes
          .map((box) => {
            const scale = box.height / fontHeight;
            const top =
              box.top +
              Math.max(
                0,
                metrics.fontBoundingBoxAscent - metrics.actualBoundingBoxAscent,
              ) *
                scale;
            const bottom =
              box.bottom -
              Math.max(
                0,
                metrics.fontBoundingBoxDescent -
                  metrics.actualBoundingBoxDescent,
              ) *
                scale;
            return new DOMRect(
              box.left,
              top,
              box.width,
              Math.max(0, bottom - top),
            );
          })
          .filter((box) => box.height > 0);
      }
    }
    if (!boxes.length) continue;
    result.checkedTextNodes++;
    const color = paint.color?.match(
      /^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/,
    );
    const textFill = paint.getPropertyValue?.("-webkit-text-fill-color");
    if (
      !complexPaint &&
      color &&
      (!color[4] || Number(color[4]) === 1) &&
      (!paint.textShadow || paint.textShadow === "none") &&
      !(
        parseFloat(
          paint.getPropertyValue?.("-webkit-text-stroke-width") || "0",
        ) > 0
      ) &&
      (!textFill || textFill === paint.color) &&
      boxes.length <= 16 &&
      result.contrastSamples!.length < 32
    ) {
      result.contrastSamples!.push({
        text: node.textContent.trim().slice(0, 100),
        bounds: boxes.map(rect),
        color: [Number(color[1]), Number(color[2]), Number(color[3])],
        minimumRatio:
          parseFloat(paint.fontSize) >= 24 ||
          (parseFloat(paint.fontSize) >= 19 && Number(paint.fontWeight) >= 700)
            ? 3
            : 4.5,
      });
    }
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
