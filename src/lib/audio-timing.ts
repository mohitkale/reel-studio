import { parseWav, pcmToWav } from "./wav";

export const DEFAULT_GAP_SECONDS = 0.3;

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
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1.2, (words / 150) * 60);
}

/**
 * Stitch per-beat WAVs into a single track with a silent gap between beats, and
 * compute each beat's startFrame / durationFrames so captions and scenes can be
 * driven purely off frame numbers. Assumes beats share format (the provider
 * layer normalizes everything to 44100 Hz mono 16-bit PCM).
 */
export function stitchBeats(
  beats: BeatInput[],
  fps: number,
  gapSeconds = DEFAULT_GAP_SECONDS,
): StitchedTake {
  if (beats.length === 0) {
    return { wav: pcmToWav(Buffer.alloc(0)), fps, totalFrames: 0, timeline: [] };
  }

  const first = parseWav(beats[0].wav);
  const { sampleRate, channels, bitsPerSample } = first;
  const bytesPerAudioFrame = channels * (bitsPerSample / 8);
  const gapAudioFrames = Math.round(gapSeconds * sampleRate);
  const gapPcm = Buffer.alloc(gapAudioFrames * bytesPerAudioFrame);

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
      pcmChunks.push(gapPcm);
      cursorAudioFrames += gapAudioFrames;
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
