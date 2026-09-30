import { z } from "zod";
import type { CaptionCue, CaptionWord } from "@/lib/captions";

const offsets = z.object({
  from: z.number().finite(),
  to: z.number().finite(),
});
const outputSchema = z.object({
  transcription: z
    .array(
      z.object({
        text: z.string(),
        offsets,
        tokens: z
          .array(
            z.object({
              text: z.string().max(240),
              offsets: offsets.optional(),
            }),
          )
          .max(500)
          .optional(),
      }),
    )
    .max(10_000),
});

/** whisper.cpp -ojf uses millisecond offsets. Merge timed subword tokens;
 * never distribute a sentence's duration across guessed words. Unsupported or
 * incomplete token output leaves ordinary SRT captions fully usable.
 * Contract: ggml-org/whisper.cpp examples/cli/cli.cpp output_json().
 */
export function attachWhisperWordTiming(
  cues: CaptionCue[],
  output: unknown,
  fps: number,
): CaptionCue[] {
  const parsed = outputSchema.safeParse(output);
  if (!parsed.success || !Number.isFinite(fps) || fps <= 0) return cues;
  return cues.map((cue) => {
    const segment = parsed.data.transcription.find(
      (segment) =>
        segment.text.trim() === cue.text.trim() &&
        Math.round((segment.offsets.from / 1000) * fps) === cue.startFrame &&
        Math.round((segment.offsets.to / 1000) * fps) === cue.endFrame,
    );
    if (!segment?.tokens) return cue;
    const groups: Array<typeof segment.tokens> = [];
    for (const token of segment.tokens) {
      if (!token.text.trim() || /^\[_.*_\]$/.test(token.text)) continue;
      if (!groups.length || /^\s/.test(token.text)) groups.push([token]);
      else groups[groups.length - 1].push(token);
    }
    const words: CaptionWord[] = groups.flatMap((tokens) => {
      if (
        tokens.some(
          (token) =>
            !token.offsets ||
            token.offsets.from < 0 ||
            token.offsets.to <= token.offsets.from,
        )
      )
        return [];
      const startFrame = Math.round(
        (Math.min(...tokens.map((token) => token.offsets!.from)) / 1000) * fps,
      );
      const endFrame = Math.round(
        (Math.max(...tokens.map((token) => token.offsets!.to)) / 1000) * fps,
      );
      const text = tokens
        .map((token) => token.text)
        .join("")
        .trim();
      return startFrame >= cue.startFrame &&
        endFrame <= cue.endFrame &&
        endFrame > startFrame &&
        text.length <= 240
        ? [{ text, startFrame, endFrame }]
        : [];
    });
    return words.length ? { ...cue, words } : cue;
  });
}
