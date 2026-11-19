import type { MouthKey, Viseme } from "./visemes";

/**
 * A numbers-only check of lip sync (roadmap P1): does the mouth open when the
 * voice is loud and close when it is quiet? It does not replace watching the
 * result at normal and half speed, which only a person can do, but it catches a
 * mouth that is late, stuck or unrelated to the audio.
 */
export const OPENNESS: Readonly<Record<Viseme, number>> = {
  rest: 0,
  mbp: 0,
  fv: 0.15,
  sz: 0.2,
  l: 0.3,
  ee: 0.35,
  r: 0.35,
  sh: 0.45,
  oo: 0.5,
  eh: 0.6,
  oh: 0.8,
  ah: 1,
};

export function opennessAt(
  track: readonly MouthKey[],
  seconds: number,
): number {
  const key = track.find((k) => seconds >= k.start && seconds < k.end);
  return key ? OPENNESS[key.viseme] : 0;
}

export function pearson(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const mean = (x: readonly number[]) =>
    x.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i]! - ma) * (b[i]! - mb);
    da += (a[i]! - ma) ** 2;
    db += (b[i]! - mb) ** 2;
  }
  return da === 0 || db === 0 ? 0 : num / Math.sqrt(da * db);
}

export interface LipSyncReport {
  /** Share of 40 ms steps where "the mouth is moving" agrees with "the voice is sounding". */
  agreement: number;
  /** Of the steps where the voice sounds, the share where the mouth is not at rest. */
  activeWhenSpeaking: number;
  /** Of the silent steps, the share where the mouth is at rest. */
  restWhenSilent: number;
  /** Correlation of mouth openness with loudness, over the steps where the voice sounds. */
  correlationWhileSpeaking: number;
  /** The audio is shifted by this many seconds against the mouth for the best agreement; 0 is in step. */
  bestLagSeconds: number;
  steps: number;
}

const SOUNDING = 0.12;

/**
 * Compare a mouth track with loudness (0 to 1 at a time). Phonemes are not
 * loudness (an "s" is quiet and a vowel is loud), so the main test is whether the
 * mouth is moving when the voice sounds and still when it does not. The best lag
 * is looked for within plus or minus 200 ms: a track that agrees best when the
 * audio is moved by more than a couple of frames is out of step.
 */
export function lipSyncReport(
  track: readonly MouthKey[],
  loudness: (seconds: number) => number,
  seconds: number,
  step = 0.04,
): LipSyncReport {
  const times: number[] = [];
  for (let t = step / 2; t < seconds; t += step) times.push(t);
  const active = times.map((t) => {
    const key = track.find((k) => t >= k.start && t < k.end);
    return Boolean(key && key.viseme !== "rest");
  });
  const agreementAt = (lag: number) =>
    times.filter((t, i) => active[i] === loudness(t + lag) > SOUNDING).length /
    Math.max(1, times.length);
  let best = { lag: 0, agreement: agreementAt(0) };
  for (let lag = -0.2; lag <= 0.2001; lag += step) {
    const agreement = agreementAt(lag);
    if (agreement > best.agreement + 1e-9) best = { lag, agreement };
  }
  const sound = times.map((t) => loudness(t));
  const speaking = sound.map((v) => v > SOUNDING);
  const share = (pick: boolean, test: (i: number) => boolean) => {
    const idx = speaking.flatMap((v, i) => (v === pick ? [i] : []));
    return idx.length ? idx.filter(test).length / idx.length : 1;
  };
  const speakingIdx = speaking.flatMap((v, i) => (v ? [i] : []));
  return {
    agreement: round(agreementAt(0)),
    activeWhenSpeaking: round(share(true, (i) => active[i]!)),
    restWhenSilent: round(share(false, (i) => !active[i]!)),
    correlationWhileSpeaking: round(
      pearson(
        speakingIdx.map((i) => opennessAt(track, times[i]!)),
        speakingIdx.map((i) => sound[i]!),
      ),
    ),
    bestLagSeconds: Math.round(best.lag * 1000) / 1000,
    steps: times.length,
  };
}

const round = (value: number) => Math.round(value * 1000) / 1000;
