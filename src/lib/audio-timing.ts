import { parseWav, pcmToWav } from "./wav";

export const DEFAULT_GAP_SECONDS = 0.45;

export interface BeatTiming {
  sceneId: string;
  startFrame: number;
  durationFrames: number;
  text: string;
}

export interface BeatInput {
  sceneId: string;
  text: string;
  wav: Buffer;
}

export interface StitchedTake {
  wav: Buffer;
  fps: number;
  totalFrames: number;
  timeline: BeatTiming[];
}

export function framesFromSeconds(seconds: number, fps: number): number {
  return Math.round(seconds * fps);
}

/** Rough spoken duration estimate (~150 wpm) for placeholder/silent takes. */
export function estimateSpeechSeconds(text: string): number {
  const trimmed = text.trim();
  // Empty beat = reflective hold between dialogue acts.
  if (!trimmed) return 2.0;
  const words = trimmed.split(/\s+/).filter(Boolean).length;
  return Math.max(1.2, (words / 150) * 60);
}

/**
 * Resolve the silent gap after beat `i` (before beat `i + 1`).
 * Accepts a single default or a per-gap list (length beats-1).
 */
function resolveGapSeconds(
  gapSeconds: number | number[],
  index: number,
  beatCount: number,
): number {
  if (typeof gapSeconds === "number") return Math.max(0, gapSeconds);
  if (index >= beatCount - 1) return 0;
  const value = gapSeconds[index];
  return Math.max(0, typeof value === "number" ? value : DEFAULT_GAP_SECONDS);
}

/**
 * Stitch per-beat WAVs into a single track with silent gaps between beats, and
 * compute each beat's startFrame / durationFrames so captions and scenes can be
 * driven purely off frame numbers. Assumes beats share format (the provider
 * layer normalizes everything to 44100 Hz mono 16-bit PCM).
 *
 * `gapSeconds` may be a single value applied between every beat, or an array of
 * length `beats.length - 1` for per-transition pacing (speaker changes, acts).
 */
export function stitchBeats(
  beats: BeatInput[],
  fps: number,
  gapSeconds: number | number[] = DEFAULT_GAP_SECONDS,
): StitchedTake {
  if (beats.length === 0) {
    return { wav: pcmToWav(Buffer.alloc(0)), fps, totalFrames: 0, timeline: [] };
  }

  const first = parseWav(beats[0].wav);
  const { sampleRate, channels, bitsPerSample } = first;
  const bytesPerAudioFrame = channels * (bitsPerSample / 8);

  const pcmChunks: Buffer[] = [];
  const timeline: BeatTiming[] = [];
  let cursorAudioFrames = 0;

  beats.forEach((beat, i) => {
    const info = parseWav(beat.wav);
    const pcm = beat.wav.subarray(
      info.dataOffset,
      info.dataOffset + info.dataLength,
    );
    const audioFrames = Math.floor(
      pcm.length / (info.channels * (info.bitsPerSample / 8)),
    );

    const startFrame = Math.round((cursorAudioFrames / sampleRate) * fps);
    const durationFrames = Math.round((audioFrames / sampleRate) * fps);
    timeline.push({
      sceneId: beat.sceneId,
      startFrame,
      durationFrames,
      text: beat.text,
    });

    pcmChunks.push(pcm);
    cursorAudioFrames += audioFrames;

    if (i < beats.length - 1) {
      const gap = resolveGapSeconds(gapSeconds, i, beats.length);
      const gapAudioFrames = Math.round(gap * sampleRate);
      if (gapAudioFrames > 0) {
        pcmChunks.push(Buffer.alloc(gapAudioFrames * bytesPerAudioFrame));
        cursorAudioFrames += gapAudioFrames;
      }
    }
  });

  const wav = pcmToWav(Buffer.concat(pcmChunks), {
    sampleRate,
    channels,
    bitsPerSample,
  });
  const totalFrames = Math.round((cursorAudioFrames / sampleRate) * fps);
  return { wav, fps, totalFrames, timeline };
}

/** Speaker key used for dialogue-aware pause sizing. */
export function dialogueSpeakerKey(
  visual: string | null | undefined,
  text: string,
): "interviewer" | "candidate" | "narrator" {
  const v = (visual || "").trim();
  if (/^candidate$/i.test(v)) return "candidate";
  if (/^interviewer$/i.test(v)) return "interviewer";
  if (
    /never asked|may i ask|chatgpt|mysql|nervous|opportunity|learning|excited|basics/i.test(
      text,
    )
  ) {
    return "candidate";
  }
  if (!v || /follow|reel\.|studio/i.test(v)) return "narrator";
  return "narrator";
}

/**
 * Build per-transition gaps for interview / multi-speaker reels.
 * Longer breaths on speaker changes and after the dialogue act ends.
 */
export function buildDialogueGaps(
  scenes: Array<{ visual?: string | null; text: string; spokenText?: string | null }>,
): number[] {
  const gaps: number[] = [];
  for (let i = 0; i < scenes.length - 1; i++) {
    const cur = scenes[i];
    const next = scenes[i + 1];
    const curSpoken = (cur.spokenText || cur.text || "").trim();
    const nextSpoken = (next.spokenText || next.text || "").trim();
    const a = dialogueSpeakerKey(cur.visual, curSpoken);
    const b = dialogueSpeakerKey(next.visual, nextSpoken);

    const leavingDialogue =
      (a === "interviewer" || a === "candidate") && b === "narrator";
    const enteringDialogue =
      a === "narrator" && (b === "interviewer" || b === "candidate");
    const speakerChange = a !== b;
    const reflectiveHold = !curSpoken || cur.text.trim() === "…";

    if (leavingDialogue || reflectiveHold) gaps.push(1.35);
    else if (enteringDialogue) gaps.push(0.85);
    else if (speakerChange) gaps.push(0.7);
    else gaps.push(0.4);
  }
  return gaps;
}
