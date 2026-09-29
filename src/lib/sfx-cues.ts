import { z } from "zod";
import type { ReelBeat } from "@/compositions/types";
import type { SceneDTO } from "@/lib/dto";
import type { VideoEngineId } from "@/engines/types";
import { resolveMotionDirection } from "@/production/motion";
import {
  motionEventSchema,
  motionEventOffsetSeconds,
} from "@/production/motion-events";
import {
  getSfxClip,
  type ScriptSfxState,
  type SfxCue,
} from "@/lib/sfx-library";

export const sfxCueSchema = z.object({
  sceneId: z.string().min(1).max(160),
  sfxId: z.enum(["whoosh", "soft-hit", "pop", "click", "riser", "swipe"]),
  offsetSeconds: z.coerce
    .number()
    .finite()
    .min(-86400)
    .max(86400)
    .catch(0)
    .default(0),
  volume: z.coerce
    .number()
    .finite()
    .catch(0.35)
    .default(0.35)
    .transform((value) => Math.max(0, Math.min(1, value))),
  source: z.enum(["automatic", "manual"]).optional(),
  locked: z.boolean().optional(),
  event: motionEventSchema.optional(),
});

export function parseSfxState(raw: string | null | undefined): ScriptSfxState {
  if (!raw?.trim()) return { enabled: true, cues: [] };
  try {
    const parsed: unknown = JSON.parse(raw);
    const root = z
      .object({
        enabled: z.boolean().optional(),
        cues: z.array(z.unknown()).default([]),
      })
      .safeParse(parsed);
    if (!root.success) return { enabled: true, cues: [] };
    const cues = root.data.cues.flatMap((value) => {
      const cue = sfxCueSchema.safeParse(value);
      return cue.success ? [cue.data] : [];
    });
    return { enabled: root.data.enabled !== false, cues };
  } catch {
    return { enabled: true, cues: [] };
  }
}

type SfxScene = Pick<
  SceneDTO,
  | "id"
  | "text"
  | "motion"
  | "chart"
  | "items"
  | "background"
  | "visual"
  | "hideText"
>;
interface ResolvedCue {
  url: string;
  startFrame: number;
  volume: number;
  endFrame: number;
  peakFrame: number;
  fadeSeconds?: number;
}

/** Resolve once against final narration timing, identically for preview/export.
 * Manual/legacy offsets stay absolute. Event offsets are creator trims from a
 * named visual landmark, with the clip's audible peak aligned to that landmark.
 * Automatic accents never spill out of their scene or compete with saved cues.
 */
export function resolveReelSfxCues(args: {
  sfxEnabled: boolean;
  sfxJson: string | null | undefined;
  timeline: ReelBeat[];
  fps: number;
  videoEngine?: VideoEngineId;
  scenes?: readonly SfxScene[];
  hideText?: boolean;
}): Array<{
  url: string;
  startFrame: number;
  volume: number;
  fadeSeconds?: number;
}> {
  if (!args.sfxEnabled || !Number.isFinite(args.fps) || args.fps <= 0)
    return [];
  const state = parseSfxState(args.sfxJson);
  if (!state.enabled) return [];
  const byScene = new Map(args.timeline.map((beat) => [beat.sceneId, beat]));
  const scenes = new Map(args.scenes?.map((scene) => [scene.id, scene]));
  const totalFrames = Math.max(
    0,
    ...args.timeline.map((beat) => beat.startFrame + beat.durationFrames),
  );
  function resolve(cue: SfxCue): ResolvedCue | undefined {
    const beat = byScene.get(cue.sceneId);
    const clip = getSfxClip(cue.sfxId);
    if (!beat || !clip || cue.volume === 0) return undefined;
    let offset = cue.offsetSeconds;
    if (cue.event) {
      const scene = scenes.get(cue.sceneId);
      if (!scene || !args.videoEngine || (scene.hideText ?? args.hideText))
        return undefined;
      const motion = resolveMotionDirection(
        scene.motion,
        scene.text,
        scene.chart,
        Boolean(scene.visual),
        scene.items,
        scene.background,
      );
      if (
        !motion ||
        motion.recipeId !== cue.event.recipeId ||
        motion.version !== cue.event.version
      )
        return undefined;
      const anchor = motionEventOffsetSeconds(
        motion,
        cue.event.anchor,
        args.videoEngine,
        args.fps,
      );
      if (anchor === undefined) return undefined;
      offset += anchor - clip.peakOffsetSeconds;
    }
    const rawStart = beat.startFrame + Math.round(offset * args.fps);
    const startFrame = Math.max(0, rawStart);
    const endFrame = startFrame + Math.ceil(clip.durationSeconds * args.fps);
    if (!Number.isFinite(rawStart) || startFrame >= totalFrames)
      return undefined;
    if (
      cue.source === "automatic" &&
      (rawStart < beat.startFrame ||
        endFrame > beat.startFrame + beat.durationFrames)
    )
      return undefined;
    return {
      ...(cue.event ? { fadeSeconds: 0 } : {}),
      url: clip.url,
      startFrame,
      volume: cue.volume,
      endFrame,
      peakFrame: startFrame + Math.round(clip.peakOffsetSeconds * args.fps),
    };
  }
  // Creator choices have priority regardless of their order in the saved array.
  const manual = state.cues
    .filter((cue) => cue.source !== "automatic" || cue.locked)
    .flatMap((cue) => {
      const resolved = resolve(cue);
      return resolved ? [resolved] : [];
    });
  const automatic = state.cues
    .filter((cue) => cue.source === "automatic" && !cue.locked)
    .flatMap((cue) => {
      const resolved = resolve(cue);
      return resolved ? [resolved] : [];
    })
    .sort((a, b) => a.startFrame - b.startFrame);
  const accepted = [...manual];
  let lastPeak = -Infinity;
  const gap = Math.round(2 * args.fps);
  const clearance = Math.round(0.12 * args.fps);
  for (const cue of automatic) {
    if (
      cue.peakFrame - lastPeak < gap ||
      accepted.some(
        (other) =>
          cue.startFrame < other.endFrame + clearance &&
          cue.endFrame > other.startFrame - clearance,
      )
    )
      continue;
    accepted.push(cue);
    lastPeak = cue.peakFrame;
  }
  return accepted
    .sort((a, b) => a.startFrame - b.startFrame)
    .map(({ url, startFrame, volume, fadeSeconds }) => ({
      url,
      startFrame,
      volume,
      ...(fadeSeconds !== undefined ? { fadeSeconds } : {}),
    }));
}
