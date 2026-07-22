/** Plain data shapes returned by the API and consumed by the client (no Prisma types). */

import type { BrandTokens } from "@/compositions/tokens";
import type { SceneBackground } from "@/compositions/types";
import type { EnergyId, StyleId } from "@/compositions/visual-style";
import type { VideoEngineId } from "@/engines/types";

export type { SceneBackground };
export type { VideoEngineId };

export interface BeatTimingDTO {
  sceneId: string;
  startFrame: number;
  durationFrames: number;
  text: string;
}

export type VoiceMode = "oneshot" | "per_scene";
export type VoiceTakeSource = "oneshot" | "assembled";

export interface SceneDTO {
  id: string;
  scriptId: string;
  order: number;
  templateId: string;
  /** On-screen display text. */
  text: string;
  /**
   * Voiceover script. null = same as `text` (typical). Set when narration
   * should differ from what appears on screen.
   */
  spokenText: string | null;
  emphasis: string[];
  visual?: string;
  background?: SceneBackground;
  items?: string[];
  /** Per-scene override for on-screen text. null = inherit the script default. */
  hideText: boolean | null;
  /** Emotional/visual tone (AI-suggested or manually set); drives dynamic backgrounds + music. */
  mood?: string;
  /** Free-text music vibe hint (e.g. "uplifting lo-fi"), used for auto music suggestions. */
  musicMood?: string;
  /** Active SceneVoiceClip in per_scene mode; null = none selected. */
  selectedVoiceClipId: string | null;
}

export interface SceneVoiceClipDTO {
  id: string;
  scriptId: string;
  sceneId: string;
  providerId: string;
  voiceId: string;
  modelId: string | null;
  text: string;
  textHash: string;
  audioUrl: string;
  durationFrames: number;
  fps: number;
  label: string | null;
  isPlaceholder: boolean;
  createdAt: string;
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
  source: VoiceTakeSource;
  createdAt: string;
}

export interface ScriptDTO {
  id: string;
  projectId: string;
  name: string;
  fps: number;
  width: number;
  height: number;
  /** Inherited from the parent project; fixed at project creation. */
  videoEngine: VideoEngineId;
  scenes: SceneDTO[];
  takes: VoiceTakeDTO[];
  /** Per-scene voice clip versions (per_scene mode). */
  voiceClips: SceneVoiceClipDTO[];
  /** oneshot = full takes; per_scene = clip library + assemble. */
  voiceMode: VoiceMode;
  brandKitId: string | null;
  brandTokens: BrandTokens;
  coverUrl: string | null;
  /** Optional background music track URL, mixed (ducked) under the voiceover. */
  musicUrl: string | null;
  /** Background music level, 0-100. */
  musicVolume: number;
  /** Global default: hide on-screen scene text (per-scene hideText overrides this). */
  hideText: boolean;
  /** Global: hide the top progress bar on every scene. */
  hideProgressBar: boolean;
  /** Whole-reel look family (Bold Hook, Clean Story, …). */
  styleId: StyleId;
  /** How fast and punchy cuts/text feel. */
  energy: EnergyId;
}

export interface ProjectDTO {
  id: string;
  name: string;
  createdAt: string;
  scriptCount: number;
  sceneCount: number;
  firstScriptId: string | null;
  brandKitId: string | null;
  videoEngine: VideoEngineId;
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
  /** Speed/resolution tradeoff used for this job. */
  quality: "draft" | "standard" | "high";
  progress: number;
  outputUrl: string | null;
  error: string | null;
  createdAt: string;
}
