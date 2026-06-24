import { z } from "zod";

/**
 * Video orientation -> pixel dimensions. A project's chosen orientation drives
 * the render canvas size, the editor preview aspect ratio, and the orientation
 * hint sent to the stock-image provider so backgrounds are sized to fit.
 */

export const ORIENTATIONS = ["portrait", "landscape", "square"] as const;
export type Orientation = (typeof ORIENTATIONS)[number];

export const orientationSchema = z.enum(ORIENTATIONS);

export const DEFAULT_ORIENTATION: Orientation = "portrait";

interface Dimensions {
  width: number;
  height: number;
}

const DIMENSIONS: Record<Orientation, Dimensions> = {
  portrait: { width: 1080, height: 1920 }, // 9:16
  landscape: { width: 1920, height: 1080 }, // 16:9
  square: { width: 1080, height: 1080 }, // 1:1
};

/** Pixel dimensions for an orientation. */
export function dimsFor(orientation: Orientation): Dimensions {
  return DIMENSIONS[orientation];
}

/** Best-effort reverse lookup: dimensions -> orientation (defaults to portrait). */
export function orientationFromDims(width: number, height: number): Orientation {
  if (width > height) return "landscape";
  if (width === height) return "square";
  return "portrait";
}

/** Map to Unsplash's `orientation` search parameter. */
export function unsplashOrientation(
  orientation: Orientation,
): "portrait" | "landscape" | "squarish" {
  return orientation === "square" ? "squarish" : orientation;
}

export const ORIENTATION_LABELS: Record<Orientation, string> = {
  portrait: "Portrait · 9:16",
  landscape: "Landscape · 16:9",
  square: "Square · 1:1",
};
