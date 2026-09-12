import { pcmToWav, parseWav } from "@/lib/wav";
import type { PodcastDTO, PodcastTakeDTO } from "@/lib/dto";
import type { Orientation } from "@/lib/orientation";
import { dimsFor } from "@/lib/orientation";
import { resolvePodcastPreset } from "@/library/podcast-presets";
import type { PodcastAudiogramProps } from "@/compositions/PodcastAudiogramComposition";

export interface PodcastAudiogramSelection {
  startTurnId: string;
  endTurnId: string;
  orientation: Orientation;
}

export interface PodcastAudiogramPlan {
  props: PodcastAudiogramProps;
  wav: Buffer;
  startFrame: number;
  endFrame: number;
  selectedTurnIds: string[];
}

export function extractWavFrames(
  wav: Buffer,
  startFrame: number,
  endFrame: number,
  fps: number,
): Buffer {
  const info = parseWav(wav);
  if (info.bitsPerSample !== 16)
    throw new Error("Audiograms require 16-bit PCM WAV audio");
  const bytesPerAudioFrame = info.channels * (info.bitsPerSample / 8);
  const totalAudioFrames = Math.floor(info.dataLength / bytesPerAudioFrame);
  const startAudioFrame = Math.max(
    0,
    Math.min(
      totalAudioFrames,
      Math.floor((startFrame / fps) * info.sampleRate),
    ),
  );
  const endAudioFrame = Math.max(
    startAudioFrame,
    Math.min(totalAudioFrames, Math.ceil((endFrame / fps) * info.sampleRate)),
  );
  const pcm = wav.subarray(
    info.dataOffset + startAudioFrame * bytesPerAudioFrame,
    info.dataOffset + endAudioFrame * bytesPerAudioFrame,
  );
  return pcmToWav(pcm, {
    sampleRate: info.sampleRate,
    channels: info.channels,
    bitsPerSample: info.bitsPerSample,
  });
}

export function waveformEnvelope(wav: Buffer, bins = 48): number[] {
  const info = parseWav(wav);
  if (info.bitsPerSample !== 16)
    return Array.from({ length: bins }, () => 0.25);
  const sampleCount = Math.floor(info.dataLength / 2);
  const samplesPerBin = Math.max(1, Math.floor(sampleCount / bins));
  return Array.from({ length: bins }, (_, bin) => {
    const start = bin * samplesPerBin;
    const end = Math.min(sampleCount, start + samplesPerBin);
    let peak = 0;
    for (let sample = start; sample < end; sample += info.channels) {
      const value =
        Math.abs(wav.readInt16LE(info.dataOffset + sample * 2)) / 32768;
      peak = Math.max(peak, value);
    }
    return Math.max(0.08, Math.min(1, peak));
  });
}

export function buildPodcastAudiogramPlan(args: {
  podcast: PodcastDTO;
  take: PodcastTakeDTO;
  sourceWav: Buffer;
  selection: PodcastAudiogramSelection;
}): PodcastAudiogramPlan {
  const { podcast, take, selection } = args;
  const startIndex = take.timeline.findIndex(
    (beat) => beat.turnId === selection.startTurnId,
  );
  const endIndex = take.timeline.findIndex(
    (beat) => beat.turnId === selection.endTurnId,
  );
  if (startIndex < 0 || endIndex < 0)
    throw new Error("Selected turn is not part of this take");
  if (endIndex < startIndex)
    throw new Error("Audiogram end must follow its start turn");
  const selected = take.timeline.slice(startIndex, endIndex + 1);
  const startFrame = selected[0].startFrame;
  const last = selected[selected.length - 1];
  const endFrame = last.startFrame + last.durationFrames;
  const durationInFrames = endFrame - startFrame;
  const durationSeconds = durationInFrames / Math.max(1, take.fps);
  if (durationSeconds < 1)
    throw new Error("Audiogram selection must be at least one second");
  if (durationSeconds > 90)
    throw new Error("Audiogram selections are limited to 90 seconds");

  const wav = extractWavFrames(args.sourceWav, startFrame, endFrame, take.fps);
  const preset = resolvePodcastPreset(podcast.presetId);
  const names = new Map(
    podcast.characters.map((character) => [character.key, character.name]),
  );
  const dimensions = dimsFor(selection.orientation);
  return {
    wav,
    startFrame,
    endFrame,
    selectedTurnIds: selected.map((beat) => beat.turnId),
    props: {
      title: podcast.title,
      presetLabel: preset.label,
      audioUrl: `data:audio/wav;base64,${wav.toString("base64")}`,
      width: dimensions.width,
      height: dimensions.height,
      fps: take.fps,
      durationInFrames,
      colors: preset.audiogram,
      waveform: waveformEnvelope(wav),
      beats: selected.map((beat) => ({
        turnId: beat.turnId,
        speaker:
          names.get(beat.characterKey ?? "") ?? beat.characterKey ?? "Speaker",
        text: beat.text,
        startFrame: beat.startFrame - startFrame,
        durationFrames: beat.durationFrames,
      })),
    },
  };
}
