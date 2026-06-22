/** Plain data shapes returned by the API and consumed by the client (no Prisma types). */

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
  scenes: SceneDTO[];
  takes: VoiceTakeDTO[];
}

export interface ProjectDTO {
  id: string;
  name: string;
  createdAt: string;
  scriptCount: number;
  sceneCount: number;
  firstScriptId: string | null;
}

export interface RenderDTO {
  id: string;
  scriptId: string;
  voiceTakeId: string | null;
  status: "queued" | "bundling" | "rendering" | "done" | "error";
  progress: number;
  outputUrl: string | null;
  error: string | null;
  createdAt: string;
}
