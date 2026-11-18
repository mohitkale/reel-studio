/**
 * Picking clips out of a recording and cutting them (roadmap P4). Plain,
 * deterministic rules over a word-timed transcript: the same recording always
 * gives the same suggestions. No model decides anything here; a writer may only
 * re-rank the result.
 */
export interface RecWord {
  text: string;
  /** Seconds from the start of the recording. */
  start: number;
  end: number;
}

export interface Sentence {
  startWord: number;
  /** Index of the last word, inclusive. */
  endWord: number;
  start: number;
  end: number;
  text: string;
  question: boolean;
}

const TERMINAL = /[.?!…]["')\]]*$/;
/** A pause this long between two words ends a sentence even without punctuation. */
const SENTENCE_GAP_SECONDS = 0.9;

export function splitSentences(words: readonly RecWord[]): Sentence[] {
  const sentences: Sentence[] = [];
  let first = 0;
  const close = (last: number) => {
    const slice = words.slice(first, last + 1);
    if (slice.length === 0) return;
    const text = slice
      .map((w) => w.text)
      .join(" ")
      .replace(/\s+([,.?!…;:])/g, "$1");
    sentences.push({
      startWord: first,
      endWord: last,
      start: slice[0]!.start,
      end: slice[slice.length - 1]!.end,
      text,
      question: /\?["')\]]*$/.test(text),
    });
    first = last + 1;
  };
  words.forEach((word, index) => {
    const next = words[index + 1];
    if (!next) return close(index);
    if (
      TERMINAL.test(word.text) ||
      next.start - word.end > SENTENCE_GAP_SECONDS
    )
      close(index);
  });
  return sentences;
}

const STOP = new Set(
  (
    "about after again also because been before being between both could does doing down during each from have " +
    "here into just like make more most much must only other over really should some such than that their them then " +
    "there these they this those through very want were what when where which while will with would your yours " +
    "i'm it's don't can't you're we're that's there's i've"
  ).split(" "),
);

function keywordsOf(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? []).filter(
    (word) => word.length > 3 && !STOP.has(word) && !/^\d+$/.test(word),
  );
}

export interface ClipSuggestion {
  startWord: number;
  endWord: number;
  start: number;
  end: number;
  seconds: number;
  /** A hook line for the title card: the opening sentence, shortened. */
  title: string;
  text: string;
  score: number;
  /** Plain words for why it was picked, shown next to the clip. */
  reasons: string[];
}

export interface SuggestOptions {
  minSeconds?: number;
  maxSeconds?: number;
  count?: number;
  /** Loudness of a span, 0 to 1 (from the audio). Optional: without it, energy is not scored. */
  energy?: (start: number, end: number) => number;
}

const CONTINUES =
  /^(and|but|so|because|or|then|which|also|anyway|yeah|well)\b/i;

function hookTitle(text: string, limit = 60): string {
  const clean = text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.…]+$/, "");
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  return `${(space > limit / 2 ? cut.slice(0, space) : cut).replace(/[,;:\s]+$/, "")}…`;
}

/**
 * Candidate clips are runs of whole sentences of the wanted length. Each is
 * scored on: a question or a number at the start, a question answered inside the
 * clip, how many of the recording's frequent words it carries, the loudness of
 * the audio, and how close it is to 35 seconds. The best non-overlapping ones win.
 */
export function suggestClips(
  words: readonly RecWord[],
  options: SuggestOptions = {},
): ClipSuggestion[] {
  const min = options.minSeconds ?? 20;
  const max = options.maxSeconds ?? 55;
  const count = options.count ?? 3;
  const sentences = splitSentences(words);
  if (sentences.length === 0) return [];

  const frequency = new Map<string, number>();
  for (const word of keywordsOf(words.map((w) => w.text).join(" ")))
    frequency.set(word, (frequency.get(word) ?? 0) + 1);
  const common = new Set(
    [...frequency.entries()]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([word]) => word),
  );

  const candidates: ClipSuggestion[] = [];
  for (let i = 0; i < sentences.length; i++) {
    for (let j = i; j < sentences.length; j++) {
      const start = sentences[i]!.start;
      const end = sentences[j]!.end;
      const seconds = end - start;
      if (seconds > max) break;
      if (seconds < min) continue;
      const slice = sentences.slice(i, j + 1);
      const first = slice[0]!;
      const reasons: string[] = ["whole sentences"];
      let score = 1;
      if (first.question) {
        score += 1.5;
        reasons.push("opens with a question");
      }
      if (/\d/.test(first.text)) {
        score += 0.5;
        reasons.push("opens with a number");
      }
      if (CONTINUES.test(first.text)) {
        score -= 2;
        reasons.push("starts mid-thought");
      }
      const answered = slice.some(
        (sentence, k) => sentence.question && k < slice.length - 1,
      );
      if (answered) {
        score += 1.5;
        reasons.push("a question and its answer");
      }
      const inside = keywordsOf(slice.map((s) => s.text).join(" "));
      const density = inside.length
        ? inside.filter((word) => common.has(word)).length / inside.length
        : 0;
      if (density > 0) {
        score += density * 4;
        if (density >= 0.15) reasons.push("on the main topic");
      }
      if (options.energy) {
        const energy = Math.max(0, Math.min(1, options.energy(start, end)));
        score += energy * 2;
        if (energy >= 0.6) reasons.push("energetic delivery");
      }
      if (slice[slice.length - 1]!.question) score -= 1;
      score -= Math.abs(seconds - 35) / 35;
      candidates.push({
        startWord: first.startWord,
        endWord: slice[slice.length - 1]!.endWord,
        start,
        end,
        seconds,
        title: hookTitle(first.text),
        text: slice.map((s) => s.text).join(" "),
        score: Math.round(score * 100) / 100,
        reasons,
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.start - b.start);
  const chosen: ClipSuggestion[] = [];
  for (const candidate of candidates) {
    if (chosen.length >= count) break;
    if (
      chosen.every((c) => candidate.end <= c.start || candidate.start >= c.end)
    )
      chosen.push(candidate);
  }
  return chosen.sort((a, b) => a.start - b.start);
}

const FILLERS = new Set([
  "um",
  "uh",
  "er",
  "erm",
  "ah",
  "hmm",
  "mm",
  "uhm",
  "umm",
  "uhh",
]);

/** Indexes of the words that are only a filler sound ("um", "uh"). Real words such as "like" are kept. */
export function fillerWordIndexes(words: readonly RecWord[]): Set<number> {
  const out = new Set<number>();
  words.forEach((word, index) => {
    if (FILLERS.has(word.text.toLowerCase().replace(/[^\p{L}]/gu, "")))
      out.add(index);
  });
  return out;
}

export interface CutOptions {
  /** Shorten pauses longer than `maxGap` to `maxGap`. */
  trimSilence?: boolean;
  removeFillers?: boolean;
  /** Words the person deleted in the transcript. */
  removed?: ReadonlySet<number>;
  maxGap?: number;
  /** Seconds of breathing room kept around each cut. */
  pad?: number;
}

export interface Segment {
  start: number;
  end: number;
}

/**
 * The stretches of the source to keep for a clip: from the first to the last
 * word, minus deleted words, filler sounds and (optionally) the middle of long
 * pauses. Segments are in source seconds, in order, and never overlap.
 */
export function planKeepSegments(
  words: readonly RecWord[],
  range: { startWord: number; endWord: number },
  options: CutOptions = {},
): Segment[] {
  const maxGap = options.maxGap ?? 0.35;
  // Cutting out a pause leaves a little of it on each side so speech does not clip.
  const pad = options.pad ?? (options.trimSilence ? 0.12 : 0.04);
  const fillers = options.removeFillers
    ? fillerWordIndexes(words)
    : new Set<number>();
  const segments: Segment[] = [];
  let current: Segment | undefined;
  let previous: RecWord | undefined;
  for (let i = range.startWord; i <= range.endWord; i++) {
    const word = words[i];
    if (!word) continue;
    if (options.removed?.has(i) || fillers.has(i)) {
      // A deleted word ends the run so the cut is exact.
      current = undefined;
      previous = undefined;
      continue;
    }
    const continues =
      current !== undefined &&
      previous !== undefined &&
      (!options.trimSilence || word.start - previous.end <= maxGap);
    if (continues && current) current.end = word.end + pad;
    else {
      current = { start: Math.max(0, word.start - pad), end: word.end + pad };
      segments.push(current);
    }
    previous = word;
  }
  // Padding must not make neighbours overlap.
  for (let i = 1; i < segments.length; i++) {
    const a = segments[i - 1]!;
    const b = segments[i]!;
    if (b.start < a.end) {
      const middle = (a.end + b.start) / 2;
      a.end = middle;
      b.start = middle;
    }
  }
  return segments;
}

/** The words that survive the cut, on the new timeline (seconds from the start of the clip). */
export function remapWords(
  words: readonly RecWord[],
  segments: readonly Segment[],
  range: { startWord: number; endWord: number },
  removed: ReadonlySet<number> = new Set(),
): RecWord[] {
  const offsets: number[] = [];
  let total = 0;
  for (const segment of segments) {
    offsets.push(total);
    total += segment.end - segment.start;
  }
  const out: RecWord[] = [];
  for (let i = range.startWord; i <= range.endWord; i++) {
    const word = words[i];
    if (!word || removed.has(i)) continue;
    const at = segments.findIndex(
      (s) => word.start >= s.start - 1e-6 && word.start < s.end,
    );
    if (at < 0) continue;
    const segment = segments[at]!;
    const start = offsets[at]! + (word.start - segment.start);
    const end = Math.min(
      offsets[at]! + (segment.end - segment.start),
      offsets[at]! + (word.end - segment.start),
    );
    out.push({ text: word.text, start, end: Math.max(end, start + 0.05) });
  }
  return out;
}

export function totalSeconds(segments: readonly Segment[]): number {
  return segments.reduce((sum, s) => sum + (s.end - s.start), 0);
}
