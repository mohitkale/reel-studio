import { z } from "zod";
export const speechWordSchema = z
  .object({
    text: z.string().trim().min(1).max(240),
    startSeconds: z.number().finite().nonnegative(),
    endSeconds: z.number().finite().positive(),
  })
  .refine(
    (word) => word.endSeconds > word.startSeconds,
    "Word must end after it starts",
  );
export const speechWordsSchema = z
  .array(speechWordSchema)
  .max(10_000)
  .refine(
    (words) =>
      words.every(
        (word, i) => !i || word.startSeconds >= words[i - 1].startSeconds,
      ),
    "Words must be ordered",
  );
export type SpeechWord = z.infer<typeof speechWordSchema>;
export const frameWordSchema = z
  .object({
    text: z.string().trim().min(1).max(240),
    startFrame: z.number().int().nonnegative(),
    endFrame: z.number().int().positive(),
  })
  .refine(
    (word) => word.endFrame > word.startFrame,
    "Word must end after it starts",
  );
export const frameWordsSchema = z.array(frameWordSchema).max(10_000);

export const characterAlignmentSchema = z
  .object({
    characters: z.array(z.string()),
    character_start_times_seconds: z.array(z.number().finite().nonnegative()),
    character_end_times_seconds: z.array(z.number().finite().nonnegative()),
  })
  .refine(
    (a) =>
      a.characters.length === a.character_start_times_seconds.length &&
      a.characters.length === a.character_end_times_seconds.length,
    "Alignment lengths differ",
  );
export function characterAlignmentWords(
  alignment: z.infer<typeof characterAlignmentSchema>,
): SpeechWord[] {
  const text = alignment.characters.join("");
  const starts: number[] = [],
    ends: number[] = [];
  alignment.characters.forEach((char, i) => {
    for (let j = 0; j < char.length; j++) {
      starts.push(alignment.character_start_times_seconds[i]);
      ends.push(alignment.character_end_times_seconds[i]);
    }
  });
  const words = [
    ...new Intl.Segmenter(undefined, { granularity: "word" }).segment(text),
  ]
    .filter((segment) => segment.isWordLike)
    .map((segment) => ({
      text: segment.segment,
      startSeconds: starts[segment.index],
      endSeconds: ends[segment.index + segment.segment.length - 1],
    }));
  return speechWordsSchema.parse(words);
}

/** A lexical completeness check, not acoustic forced alignment. Reject ASR/provider
 * omissions and expansions rather than relabeling guessed times as measured. */
export function speechWordsMatchText(
  text: string,
  words: Array<{ text: string }>,
): boolean {
  const tokens = (value: string) =>
    [
      ...new Intl.Segmenter(undefined, { granularity: "word" }).segment(
        value.normalize("NFKC").toLowerCase(),
      ),
    ]
      .filter((part) => part.isWordLike)
      .map((part) => part.segment);
  const expected = tokens(text),
    actual = words.flatMap((word) => tokens(word.text));
  return (
    expected.length > 0 &&
    expected.length === actual.length &&
    expected.every((word, i) => word === actual[i])
  );
}
