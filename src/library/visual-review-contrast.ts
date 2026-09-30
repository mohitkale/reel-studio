import sharp from "sharp";
import type { LayoutEvidence } from "@/production/visual-review-layout";

function luminance(rgb: readonly number[]): number {
  const channels = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

/** Conservative pixel warning: even the strongest sampled contrast is low.
 * Foreground/antialias pixels may be included; gradients, shadows, strokes,
 * transparent paints and blending are excluded by the native probe. A passing
 * sample is not a whole-frame legibility or accessibility assessment.
 */
export async function reviewPixelContrast(
  image: string | Buffer,
  evidence: LayoutEvidence,
): Promise<LayoutEvidence> {
  const { data, info } = await sharp(image)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const result = structuredClone(evidence);
  result.contrastCheckedTextNodes = 0;
  for (const sample of result.contrastSamples ?? []) {
    const foreground = luminance(sample.color);
    let strongest = 1;
    let count = 0;
    for (const rect of sample.bounds) {
      const left = Math.max(0, Math.ceil(rect.left));
      const top = Math.max(0, Math.ceil(rect.top));
      const right = Math.min(info.width, Math.floor(rect.right));
      const bottom = Math.min(info.height, Math.floor(rect.bottom));
      if (right <= left || bottom <= top) continue;
      // At most 16 rectangles × 8×8 points per text span, 32 spans per frame.
      const nx = Math.min(8, right - left),
        ny = Math.min(8, bottom - top);
      for (let y = 0; y < ny; y++)
        for (let x = 0; x < nx; x++) {
          const px = left + Math.floor(((x + 0.5) * (right - left)) / nx);
          const py = top + Math.floor(((y + 0.5) * (bottom - top)) / ny);
          const offset = (py * info.width + px) * 4;
          if (data[offset + 3] !== 255) continue;
          const background = luminance([
            data[offset],
            data[offset + 1],
            data[offset + 2],
          ]);
          strongest = Math.max(
            strongest,
            (Math.max(foreground, background) + 0.05) /
              (Math.min(foreground, background) + 0.05),
          );
          count++;
        }
    }
    if (!count) continue;
    result.contrastCheckedTextNodes++;
    if (strongest < sample.minimumRatio && result.issues.length < 8) {
      const bounds = sample.bounds.reduce((a, b) => ({
        left: Math.min(a.left, b.left),
        top: Math.min(a.top, b.top),
        right: Math.max(a.right, b.right),
        bottom: Math.max(a.bottom, b.bottom),
      }));
      result.issues.push({
        kind: "contrast",
        text: sample.text,
        bounds,
        contrastRatio: Math.round(strongest * 100) / 100,
      });
    }
  }
  return result;
}
