/** Plain data shapes returned by the API and consumed by the client (no Prisma types). */

import type { BrandTokens } from "@/compositions/tokens";
import type { SceneBackground } from "@/compositions/types";

export type { SceneBackground };

export interface BeatTimingDTO {
  sceneId: string;
  startFrame: number;
  durationFrames: number;
  text: string;
}

export interface SceneDTO {
  id: string;
  scriptId: string;
  order: number;
  templateId: string;
  text: string;
  emphasis: string[];
  visual?: string;
  background?: SceneBackground;
  items?: string[];
}

export interface VoiceTakeDTO {
  id: string;
  scriptId: string;
  label: string | null;
  providerId: string;
  voiceId: string;
  modelId: string | null;
  fps: number;
  totalFrames: number;
  timeline: BeatTimingDTO[];
  audioUrl: string;
  isPlaceholder: boolean;
  createdAt: string;
}

export interface ScriptDTO {
  id: string;
  projectId: string;
  name: string;
  fps: number;
  width: number;
  height: number;
  scenes: SceneDTO[];
  takes: VoiceTakeDTO[];
  brandKitId: string | null;
  brandTokens: BrandTokens;
  coverUrl: string | null;
}

export interface ProjectDTO {
  id: string;
  name: string;
  createdAt: string;
  scriptCount: number;
  sceneCount: number;
  firstScriptId: string | null;
  brandKitId: string | null;
}

export interface AssetDTO {
  id: string;
  type: "image" | "lottie" | "audio" | "video";
  name: string | null;
  url: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface BrandKitDTO {
  id: string;
  name: string;
  tokens: BrandTokens;
  handle: string | null;
  logoAssetId: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RenderDTO {
  id: string;
  scriptId: string;
  voiceTakeId: string | null;
  name: string | null;
  status:
    | "pending_approval"
    | "queued"
    | "bundling"
    | "rendering"
    | "done"
    | "error";
  progress: number;
  outputUrl: string | null;
  error: string | null;
  createdAt: string;
}
