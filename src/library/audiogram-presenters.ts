import { buildPresenterTrack } from "@/library/presenter-track";
import type {
  AudiogramPresenter,
  PodcastAudiogramProps,
} from "@/video/podcast-audiogram";
import type { MouthKey } from "@/video/visemes";

/** The two hosts, in the order the speakers first talk. */
const HOSTS = ["maya", "sam"] as const;

/**
 * One presenter for each of the first two speakers. A speaker's mouth moves only
 * during that speaker's turns, from the words of the turn spread across its time;
 * the other presenter listens (blinks, mouth at rest). No speaker separation is
 * needed: the podcast already knows who says each turn.
 */
export async function buildAudiogramPresenters(
  props: PodcastAudiogramProps,
): Promise<AudiogramPresenter[]> {
  const seconds = props.durationInFrames / props.fps;
  const speakers = [...new Set(props.beats.map((beat) => beat.speaker))].slice(
    0,
    2,
  );
  const height = props.height * (props.width > props.height ? 0.42 : 0.3);
  const width = height * 0.8;
  const top = props.height - height - props.height * 0.1;
  const out: AudiogramPresenter[] = [];
  for (const [index, speaker] of speakers.entries()) {
    const words = props.beats
      .filter((beat) => beat.speaker === speaker)
      .flatMap((beat) => {
        const parts = beat.text.split(/\s+/).filter(Boolean);
        const start = beat.startFrame / props.fps;
        const span =
          beat.durationFrames / props.fps / Math.max(1, parts.length);
        return parts.map((text, i) => ({
          text,
          start: start + i * span,
          end: start + (i + 1) * span,
        }));
      });
    const track = await buildPresenterTrack({
      words,
      seconds,
      seed: `${props.title}:${speaker}`,
    });
    const gap = props.width * 0.06;
    const left =
      index === 0
        ? props.width / 2 - width - gap / 2
        : props.width / 2 + gap / 2;
    out.push({
      characterId: HOSTS[index]!,
      uid: `s${index}`,
      box: { left, top, width, height },
      mouth: track.mouth as MouthKey[],
      blinks: track.blinks,
      nods: track.accents.filter((a) => a.kind === "nod").map((a) => a.at),
    });
  }
  return out;
}
