import { remotionEngine } from "@/engines/remotion/engine";
import { hyperframesEngine } from "@/engines/hyperframes/engine";
import {
  DEFAULT_VIDEO_ENGINE,
  type VideoEngine,
  type VideoEngineId,
  isVideoEngineId,
} from "@/engines/types";

const engines: Record<VideoEngineId, VideoEngine> = {
  remotion: remotionEngine,
  hyperframes: hyperframesEngine,
};

export function getVideoEngine(id: VideoEngineId | string | null | undefined): VideoEngine {
  if (id && isVideoEngineId(id)) return engines[id];
  return engines[DEFAULT_VIDEO_ENGINE];
}

export function listVideoEngines(): VideoEngine[] {
  return Object.values(engines);
}

export function normalizeTemplateIdForEngine(
  engineId: VideoEngineId | string | null | undefined,
  templateId: string,
): string {
  return getVideoEngine(engineId).normalizeTemplateId(templateId);
}

export function defaultTemplateIdForEngine(
  engineId: VideoEngineId | string | null | undefined,
): string {
  return getVideoEngine(engineId).defaultTemplateId;
}
