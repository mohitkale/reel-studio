import { parseWav, pcmToWav } from "@/lib/wav";
import type {
  PodcastFinishingSnapshot,
  PodcastPronunciation,
} from "@/library/podcast-schemas";

const BUMPER_GAIN = 0.32;
const BUMPER_FADE_SECONDS = 0.75;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Apply ordered pronunciation rules only to provider-bound spoken text. */
export function applyPodcastPronunciations(
  text: string,
  rules: PodcastPronunciation[],
): string {
  return rules.reduce(
    (value, rule) =>
      value.replace(
        new RegExp(escapeRegExp(rule.find), rule.caseSensitive ? "g" : "gi"),
        () => rule.replaceWith,
      ),
    text,
  );
}

function bumperPcm(wav: Buffer): { pcm: Buffer; audioFrames: number } {
  const info = parseWav(wav);
  if (
    info.sampleRate !== 44_100 ||
    info.channels !== 1 ||
    info.bitsPerSample !== 16
  ) {
    throw new Error(
      "Podcast bumpers must be decoded to 44.1 kHz mono 16-bit PCM",
    );
  }
  const pcm = Buffer.from(
    wav.subarray(info.dataOffset, info.dataOffset + info.dataLength),
  );
  const audioFrames = Math.floor(pcm.length / 2);
  const fadeFrames = Math.min(
    Math.floor(BUMPER_FADE_SECONDS * info.sampleRate),
    Math.floor(audioFrames / 2),
  );
  for (let frame = 0; frame < audioFrames; frame += 1) {
    const fadeIn = fadeFrames ? Math.min(1, frame / fadeFrames) : 1;
    const fadeOut = fadeFrames
      ? Math.min(1, (audioFrames - frame - 1) / fadeFrames)
      : 1;
    const gain = BUMPER_GAIN * Math.max(0, Math.min(fadeIn, fadeOut));
    const sample = pcm.readInt16LE(frame * 2);
    pcm.writeInt16LE(Math.round(sample * gain), frame * 2);
  }
  return { pcm, audioFrames };
}

export function assemblePodcastMaster(args: {
  speechWav: Buffer;
  introWav?: Buffer;
  outroWav?: Buffer;
  fps: number;
}): { wav: Buffer; introFrames: number; outroFrames: number } {
  const speech = parseWav(args.speechWav);
  if (
    speech.sampleRate !== 44_100 ||
    speech.channels !== 1 ||
    speech.bitsPerSample !== 16
  ) {
    throw new Error("Podcast speech must be 44.1 kHz mono 16-bit PCM");
  }
  const intro = args.introWav ? bumperPcm(args.introWav) : null;
  const outro = args.outroWav ? bumperPcm(args.outroWav) : null;
  const speechPcm = args.speechWav.subarray(
    speech.dataOffset,
    speech.dataOffset + speech.dataLength,
  );
  return {
    wav: pcmToWav(
      Buffer.concat([
        intro?.pcm ?? Buffer.alloc(0),
        speechPcm,
        outro?.pcm ?? Buffer.alloc(0),
      ]),
    ),
    introFrames: Math.round(((intro?.audioFrames ?? 0) / 44_100) * args.fps),
    outroFrames: Math.round(((outro?.audioFrames ?? 0) / 44_100) * args.fps),
  };
}

export function emptyPodcastFinishingSnapshot(): PodcastFinishingSnapshot {
  return {
    version: 1,
    intro: null,
    outro: null,
    pronunciations: [],
    pauses: [],
  };
}
