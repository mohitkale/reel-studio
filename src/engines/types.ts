/**
 * Video engine contract. Mirrors the voice provider factory: product code talks
 * to this interface; Remotion and HyperFrames are interchangeable adapters.
 */

import type { TemplateMeta } from "@/compositions/templates";

export const VIDEO_ENGINE_IDS = ["remotion", "hyperframes"] as const;
export type VideoEngineId = (typeof VIDEO_ENGINE_IDS)[number];

export const DEFAULT_VIDEO_ENGINE: VideoEngineId = "remotion";

export const VIDEO_ENGINE_LABELS: Record<VideoEngineId, string> = {
  remotion: "Remotion",
  hyperframes: "HyperFrames",
};

export const VIDEO_ENGINE_DESCRIPTIONS: Record<VideoEngineId, string> = {
  remotion:
    "React-based compositions. Mature preview and export (Remotion License).",
  hyperframes:
    "HTML-native compositions. Apache 2.0 — commercially open at any scale.",
};

export type EngineTemplateMeta = TemplateMeta;

export interface VideoEngine {
  id: VideoEngineId;
  label: string;
  description: string;
  defaultTemplateId: string;
  listTemplates(): EngineTemplateMeta[];
  normalizeTemplateId(id: string): string;
}

export function isVideoEngineId(value: string): value is VideoEngineId {
  return (VIDEO_ENGINE_IDS as readonly string[]).includes(value);
}
