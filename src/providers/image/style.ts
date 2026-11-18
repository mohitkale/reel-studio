import { createHash } from "node:crypto";

import type { Orientation } from "@/lib/orientation";

/** Words added after a prompt so a generated picture suits the look of the video. */
const THEME_STYLE: Record<string, string> = {
  "bold-pop":
    "bold flat colours, high contrast, pop art illustration, clean shapes",
  "clean-minimal":
    "minimal composition, soft light, lots of empty space, muted colours",
  "midnight-tech":
    "dark background, cool blue glow, futuristic, clean digital render",
  "editorial-paper":
    "paper texture, editorial illustration, warm off-white tones",
  neon: "neon glow, dark background, vivid magenta and cyan light, synthwave",
  "warm-documentary": "documentary photograph, warm natural light, film grain",
  "corporate-blue":
    "clean corporate style, soft blue tones, professional, bright",
  "playful-pastel":
    "pastel colours, playful, soft shapes, friendly illustration",
  "mono-brutalist": "black and white, brutalist, stark shadows, graphic",
  cinematic:
    "cinematic still, dramatic lighting, shallow depth of field, wide lens",
};
const DEFAULT_STYLE = "clean, well lit, no text, no logos";

export function imageStyleForTheme(themeId: string | undefined): string {
  return `${(themeId && THEME_STYLE[themeId]) || DEFAULT_STYLE}, no text, no watermark`;
}

/** Stable-diffusion-friendly sizes (multiples of 64) for each frame shape. */
export function imageSize(orientation: Orientation): {
  width: number;
  height: number;
} {
  if (orientation === "portrait") return { width: 576, height: 1024 };
  if (orientation === "square") return { width: 768, height: 768 };
  return { width: 1024, height: 576 };
}

/** A 31-bit seed from the video's seed and the scene, so a video always gets the same pictures. */
export function imageSeed(videoSeed: string, sceneIndex: number): number {
  const digest = createHash("sha256")
    .update(`${videoSeed}:${sceneIndex}`)
    .digest();
  return digest.readUInt32BE(0) & 0x7fffffff;
}

/** The cache key: the same prompt, style, seed, size and model give the same file. */
export function imageCacheKey(parts: {
  providerId: string;
  model: string;
  prompt: string;
  style: string;
  seed: number;
  width: number;
  height: number;
}): string {
  return createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex")
    .slice(0, 40);
}
