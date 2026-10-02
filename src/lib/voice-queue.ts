import type {
  PodcastTakeDTO,
  SceneVoiceClipDTO,
  VoiceTakeDTO,
} from "@/lib/dto";

export type VoiceJobStatus =
  "queued" | "synthesizing" | "stitching" | "done" | "error";

export interface VoiceJob {
  id: string;
  status: VoiceJobStatus;
  /** Scenes/turns fully synthesized so far. */
  scene: number;
  sceneCount: number;
  /** 1-based index of the beat currently being synthesized, if any. */
  workingOn?: number;
  /** Podcast turn-cache accounting for visible selective regeneration. */
  cached?: number;
  generated?: number;
  error?: string;
  /** Set once status === "done" for oneshot / assemble jobs. */
  take?: VoiceTakeDTO;
  /** Set when a podcast take job finishes. */
  podcastTake?: PodcastTakeDTO;
  /** Set when a single-scene clip job finishes. */
  clip?: SceneVoiceClipDTO;
  /** Set when a generate-all clips job finishes. */
  clips?: SceneVoiceClipDTO[];
}
