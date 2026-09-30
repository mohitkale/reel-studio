// @vitest-environment node
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { reviewPixelContrast } from "./visual-review-contrast";
import type { LayoutEvidence } from "@/production/visual-review-layout";

function evidence(
  color: [number, number, number] = [100, 100, 100],
): LayoutEvidence {
  return {
    frame: 39,
    checkedTextNodes: 1,
    truncated: false,
    issues: [],
    contrastSamples: [
      {
        text: "Readable copy",
        color,
        minimumRatio: 4.5,
        bounds: [{ left: 0, top: 0, right: 16, bottom: 16 }],
      },
    ],
  };
}
const image = (r: number, g: number, b: number, alpha = 1) =>
  sharp({
    create: {
      width: 16,
      height: 16,
      channels: 4,
      background: { r, g, b, alpha },
    },
  })
    .png()
    .toBuffer();
describe("conservative native pixel contrast", () => {
  it("reports low contrast with measured ratio and preserves native bounds", async () => {
    const original = evidence();
    const result = await reviewPixelContrast(
      await image(110, 110, 110),
      original,
    );
    expect(result.contrastCheckedTextNodes).toBe(1);
    expect(result.issues[0]).toMatchObject({
      kind: "contrast",
      text: "Readable copy",
      bounds: { right: 16 },
    });
    expect(result.issues[0].contrastRatio).toBeLessThan(1.2);
    expect(original.issues).toEqual([]);
  });
  it("does not count foreground glyph pixels as low contrast on a dark backdrop", async () => {
    const png = await sharp(await image(0, 0, 0))
      .composite([
        { input: await image(255, 255, 255), blend: "over", left: 0, top: 0 },
      ])
      .png()
      .toBuffer();
    // Use actual black/white pixel blocks; the strongest contrast protects mixed glyph/background pixels.
    const raw = await sharp(png).raw().toBuffer();
    raw.fill(0, 0, 16 * 4 * 8);
    for (let offset = 3; offset < 16 * 4 * 8; offset += 4) raw[offset] = 255;
    const result = await reviewPixelContrast(
      await sharp(raw, { raw: { width: 16, height: 16, channels: 4 } })
        .png()
        .toBuffer(),
      evidence([255, 255, 255]),
    );
    expect(result.issues).toEqual([]);
    expect(result.contrastCheckedTextNodes).toBe(1);
  });
  it("skips transparent pixels and text outside the capture", async () => {
    expect(
      (await reviewPixelContrast(await image(100, 100, 100, 0), evidence()))
        .contrastCheckedTextNodes,
    ).toBe(0);
    const outside = evidence();
    outside.contrastSamples![0].bounds[0] = {
      left: -20,
      top: -20,
      right: -10,
      bottom: -10,
    };
    expect(
      (await reviewPixelContrast(await image(100, 100, 100), outside)).issues,
    ).toEqual([]);
  });
  it("preserves existing findings and the eight-finding limit", async () => {
    const input = evidence();
    input.issues = Array.from({ length: 8 }, () => ({
      kind: "safe-area" as const,
      text: "Original",
      bounds: { left: 0, top: 0, right: 16, bottom: 16 },
    }));
    expect(
      (await reviewPixelContrast(await image(110, 110, 110), input)).issues,
    ).toEqual(input.issues);
  });
});
