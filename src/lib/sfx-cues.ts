import type { ReelBeat } from "@/compositions/types";
import {
  getSfxClip,
  type ScriptSfxState,
  type SfxCue,
  type SfxId,
} from "@/lib/sfx-library";

export function parseSfxState(raw: string | null | undefined): ScriptSfxState {
  if (!raw?.trim()) return { enabled: true, cues: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<ScriptSfxState>;
    const cues = Array.isArray(parsed.cues)
      ? parsed.cues.filter(
          (c): c is SfxCue =>
            Boolean(c?.sceneId && c?.sfxId && getSfxClip(String(c.sfxId))),
        )
      : [];
    return {
      enabled: parsed.enabled !== false,
      cues: cues.map((c) => ({
        sceneId: c.sceneId,
        sfxId: c.sfxId as SfxId,
        offsetSeconds: Number(c.offsetSeconds) || 0,
        volume: Math.max(0, Math.min(1, Number(c.volume) || 0.35)),
      })),
    };
  } catch {
    return { enabled: true, cues: [] };
  }
}

/** Resolve stored cues onto absolute content-timeline frames for Remotion/HF. */
export function resolveReelSfxCues(args: {
  sfxEnabled: boolean;
  sfxJson: string | null | undefined;
  timeline: ReelBeat[];
  fps: number;
}): Array<{ url: string; startFrame: number; volume: number }> {
  if (!args.sfxEnabled) return [];
  const state = parseSfxState(args.sfxJson);
  if (!state.enabled || state.cues.length === 0) return [];
  const byScene = new Map(args.timeline.map((b) => [b.sceneId, b]));
  const out: Array<{ url: string; startFrame: number; volume: number }> = [];
  for (const cue of state.cues) {
    const beat = byScene.get(cue.sceneId);
    const clip = getSfxClip(cue.sfxId);
    if (!beat || !clip) continue;
    const offsetFrames = Math.round(cue.offsetSeconds * args.fps);
    out.push({
      url: clip.url,
      startFrame: Math.max(0, beat.startFrame + offsetFrames),
      volume: cue.volume,
    });
  }
  return out;
}
