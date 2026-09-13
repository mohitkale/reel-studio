export const DEFAULT_MUSIC_DUCK_RATIO = 0.35;
export const DEFAULT_AUDIO_FADE_SECONDS = 0.35;

export interface AudioActivityRange {
  startFrame: number;
  endFrame: number;
}

export interface AudioMixPlan {
  totalFrames: number;
  fadeFrames: number;
  musicVolume: number;
  duckRatio: number;
  narration: AudioActivityRange[];
}

export function buildAudioMixPlan(input: {
  fps: number;
  totalFrames: number;
  musicVolume?: number;
  narration?: Array<{ startFrame: number; durationFrames: number }>;
  fadeSeconds?: number;
  duckRatio?: number;
}): AudioMixPlan {
  const fps = Math.max(1, input.fps);
  return {
    totalFrames: Math.max(1, input.totalFrames),
    fadeFrames: Math.max(
      0,
      Math.round((input.fadeSeconds ?? DEFAULT_AUDIO_FADE_SECONDS) * fps),
    ),
    musicVolume: Math.max(0, Math.min(1, (input.musicVolume ?? 20) / 100)),
    duckRatio: Math.max(
      0,
      Math.min(1, input.duckRatio ?? DEFAULT_MUSIC_DUCK_RATIO),
    ),
    narration: (input.narration ?? []).map((beat) => ({
      startFrame: Math.max(0, beat.startFrame),
      endFrame: Math.max(
        beat.startFrame,
        beat.startFrame + beat.durationFrames,
      ),
    })),
  };
}

export function musicVolumeAtFrame(frame: number, plan: AudioMixPlan): number {
  const clamped = Math.max(0, Math.min(plan.totalFrames, frame));
  const fadeIn =
    plan.fadeFrames > 0 ? Math.min(1, clamped / plan.fadeFrames) : 1;
  const remaining = Math.max(0, plan.totalFrames - clamped);
  const fadeOut =
    plan.fadeFrames > 0 ? Math.min(1, remaining / plan.fadeFrames) : 1;
  const narrated = plan.narration.some(
    (range) => clamped >= range.startFrame && clamped < range.endFrame,
  );
  return (
    plan.musicVolume *
    Math.min(fadeIn, fadeOut) *
    (narrated ? plan.duckRatio : 1)
  );
}

export function clipVolumeAtFrame(
  frame: number,
  durationFrames: number,
  volume: number,
  fadeFrames: number,
): number {
  const gain = Math.max(0, Math.min(1, volume));
  const duration = Math.max(1, durationFrames);
  const fade = Math.max(0, Math.min(fadeFrames, Math.floor(duration / 2)));
  if (fade === 0) return gain;
  const fadeIn = Math.min(1, Math.max(0, frame) / fade);
  const fadeOut = Math.min(1, Math.max(0, duration - frame) / fade);
  return gain * Math.min(fadeIn, fadeOut);
}
