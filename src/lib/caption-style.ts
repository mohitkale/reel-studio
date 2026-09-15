import { z } from "zod";

import type { ProductionPresetId } from "@/production/presets";

export const CAPTION_STYLE_VERSION = 1 as const;

export const captionStyleIdSchema = z.enum([
  "legacy",
  "minimal",
  "editorial",
  "karaoke",
  "technical",
  "cinematic",
]);
export type CaptionStyleId = z.infer<typeof captionStyleIdSchema>;

const colorSchema = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, "Use a 6-digit hex color");
const safeOffsetSchema = z
  .object({
    top: z.number().min(0).max(0.15),
    right: z.number().min(0).max(0.15),
    bottom: z.number().min(0).max(0.15),
    left: z.number().min(0).max(0.15),
  })
  .strict();

export const captionStyleSnapshotSchema = z
  .object({
    version: z.literal(CAPTION_STYLE_VERSION),
    presetId: captionStyleIdSchema,
    fontFamily: z.enum(["brand", "sans", "display", "serif", "mono"]),
    fontSize: z.number().int().min(20).max(96),
    fontWeight: z.union([
      z.literal(400),
      z.literal(500),
      z.literal(600),
      z.literal(700),
      z.literal(800),
      z.literal(900),
    ]),
    lineHeight: z.number().min(0.9).max(1.6),
    letterSpacing: z.number().min(-0.08).max(0.2),
    position: z.enum(["top", "center", "bottom"]),
    alignment: z.enum(["left", "center", "right"]),
    textColor: colorSchema,
    activeWordColor: colorSchema,
    backgroundColor: colorSchema,
    backgroundOpacity: z.number().min(0).max(1),
    paddingX: z.number().int().min(0).max(64),
    paddingY: z.number().int().min(0).max(48),
    radius: z.number().int().min(0).max(64),
    outlineColor: colorSchema,
    outlineWidth: z.number().min(0).max(8),
    shadowColor: colorSchema,
    shadowOpacity: z.number().min(0).max(1),
    shadowBlur: z.number().int().min(0).max(48),
    shadowOffsetX: z.number().int().min(-24).max(24),
    shadowOffsetY: z.number().int().min(-24).max(24),
    maxWordsPerLine: z.number().int().min(1).max(12),
    maxLines: z.number().int().min(1).max(4),
    highlightMode: z.enum(["none", "word", "phrase", "karaoke"]),
    safeAreaOffsets: z
      .object({
        portrait: safeOffsetSchema,
        landscape: safeOffsetSchema,
        square: safeOffsetSchema,
      })
      .strict(),
  })
  .strict();

export type CaptionStyleSnapshot = z.infer<typeof captionStyleSnapshotSchema>;

const ZERO_SAFE_OFFSETS = {
  portrait: { top: 0, right: 0, bottom: 0, left: 0 },
  landscape: { top: 0, right: 0, bottom: 0, left: 0 },
  square: { top: 0, right: 0, bottom: 0, left: 0 },
} as const;

export const LEGACY_CAPTION_STYLE: CaptionStyleSnapshot = {
  version: 1,
  presetId: "legacy",
  fontFamily: "brand",
  fontSize: 38,
  fontWeight: 700,
  lineHeight: 1.18,
  letterSpacing: 0,
  position: "bottom",
  alignment: "center",
  textColor: "#ffffff",
  activeWordColor: "#ff6b4a",
  backgroundColor: "#080a10",
  backgroundOpacity: 0.82,
  paddingX: 26,
  paddingY: 16,
  radius: 18,
  outlineColor: "#000000",
  outlineWidth: 0,
  shadowColor: "#000000",
  shadowOpacity: 0.28,
  shadowBlur: 40,
  shadowOffsetX: 0,
  shadowOffsetY: 10,
  maxWordsPerLine: 8,
  maxLines: 2,
  highlightMode: "word",
  safeAreaOffsets: ZERO_SAFE_OFFSETS,
};

function style(
  presetId: Exclude<CaptionStyleId, "legacy">,
  overrides: Partial<CaptionStyleSnapshot>,
): CaptionStyleSnapshot {
  return captionStyleSnapshotSchema.parse({
    ...LEGACY_CAPTION_STYLE,
    presetId,
    ...overrides,
  });
}

export const CAPTION_STYLE_PRESETS: Record<
  CaptionStyleId,
  CaptionStyleSnapshot
> = {
  legacy: LEGACY_CAPTION_STYLE,
  minimal: style("minimal", {
    fontSize: 34,
    fontWeight: 600,
    backgroundOpacity: 0.68,
    paddingX: 22,
    paddingY: 12,
    radius: 14,
    shadowBlur: 24,
    shadowOffsetY: 6,
    highlightMode: "none",
  }),
  editorial: style("editorial", {
    fontFamily: "serif",
    fontSize: 39,
    fontWeight: 600,
    lineHeight: 1.28,
    letterSpacing: -0.015,
    alignment: "left",
    backgroundColor: "#f5f1e8",
    backgroundOpacity: 0.94,
    textColor: "#171717",
    activeWordColor: "#9b2c2c",
    radius: 6,
    outlineWidth: 0,
    shadowOpacity: 0.2,
    maxWordsPerLine: 7,
    maxLines: 3,
    highlightMode: "phrase",
  }),
  karaoke: style("karaoke", {
    fontFamily: "display",
    fontSize: 48,
    fontWeight: 900,
    lineHeight: 1.05,
    letterSpacing: 0.01,
    textColor: "#ffffff",
    activeWordColor: "#ffd54a",
    backgroundColor: "#120b24",
    backgroundOpacity: 0.76,
    paddingX: 30,
    paddingY: 18,
    radius: 24,
    outlineColor: "#000000",
    outlineWidth: 2,
    shadowOpacity: 0.5,
    shadowBlur: 20,
    shadowOffsetY: 8,
    maxWordsPerLine: 5,
    highlightMode: "karaoke",
  }),
  technical: style("technical", {
    fontFamily: "mono",
    fontSize: 32,
    fontWeight: 600,
    lineHeight: 1.24,
    letterSpacing: -0.01,
    alignment: "left",
    textColor: "#d8f3ff",
    activeWordColor: "#59e1ff",
    backgroundColor: "#07131b",
    backgroundOpacity: 0.92,
    paddingX: 20,
    paddingY: 14,
    radius: 8,
    outlineColor: "#173845",
    outlineWidth: 1,
    shadowBlur: 16,
    shadowOffsetY: 4,
    maxWordsPerLine: 7,
    maxLines: 3,
    highlightMode: "word",
  }),
  cinematic: style("cinematic", {
    fontFamily: "display",
    fontSize: 36,
    fontWeight: 500,
    lineHeight: 1.3,
    letterSpacing: 0.04,
    textColor: "#fff8e8",
    activeWordColor: "#e9c46a",
    backgroundColor: "#050505",
    backgroundOpacity: 0.55,
    paddingX: 28,
    paddingY: 14,
    radius: 2,
    outlineColor: "#000000",
    outlineWidth: 1,
    shadowOpacity: 0.7,
    shadowBlur: 28,
    shadowOffsetY: 8,
    maxWordsPerLine: 7,
    maxLines: 3,
    highlightMode: "none",
  }),
};

const PRESET_CAPTION_STYLES: Record<ProductionPresetId, CaptionStyleId> = {
  "product-launch": "minimal",
  "editorial-explainer": "editorial",
  "creator-punch": "karaoke",
  "data-story": "minimal",
  "developer-demo": "technical",
  "cinematic-brand": "cinematic",
};

export function captionStyleForProductionPreset(
  presetId?: ProductionPresetId,
): CaptionStyleSnapshot {
  return CAPTION_STYLE_PRESETS[
    presetId ? PRESET_CAPTION_STYLES[presetId] : "minimal"
  ];
}

function channel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const value = hex.slice(1);
  return (
    0.2126 * channel(Number.parseInt(value.slice(0, 2), 16)) +
    0.7152 * channel(Number.parseInt(value.slice(2, 4), 16)) +
    0.0722 * channel(Number.parseInt(value.slice(4, 6), 16))
  );
}

export function captionStyleWarnings(style: CaptionStyleSnapshot): string[] {
  const foreground = luminance(style.textColor);
  const background = luminance(style.backgroundColor);
  const contrast =
    (Math.max(foreground, background) + 0.05) /
    (Math.min(foreground, background) + 0.05);
  const warnings: string[] = [];
  if (style.backgroundOpacity >= 0.65 && contrast < 4.5) {
    warnings.push(
      `Text and caption box contrast is ${contrast.toFixed(1)}:1; use at least 4.5:1 for readable captions.`,
    );
  }
  if (style.backgroundOpacity < 0.35 && style.outlineWidth < 1) {
    warnings.push(
      "Low box opacity needs an outline or stronger background for reliable contrast over video.",
    );
  }
  return warnings;
}
