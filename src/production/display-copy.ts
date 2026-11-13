/** Longest on-screen line the planners keep whole. */
export const DISPLAY_MAX_WORDS = 18;
export const DISPLAY_MAX_CHARS = 150;

export interface DisplayCopy {
  text: string;
  /** True when the on-screen text is a shorter, complete part of the narration. */
  shortened: boolean;
}

const words = (text: string) => text.split(/\s+/).filter(Boolean);
const fits = (text: string) =>
  words(text).length <= DISPLAY_MAX_WORDS &&
  Array.from(text).length <= DISPLAY_MAX_CHARS;

/**
 * On-screen copy for a spoken line. Text is fitted, not cut: a line that fits is
 * kept as is; a longer one is shortened only to a complete sentence or clause,
 * never mid-phrase and never with an ellipsis. When no complete part fits, the
 * full line is kept and the layout fits it by size.
 */
export function fitDisplayCopy(narration: string): DisplayCopy {
  const text = narration.replace(/\s+/g, " ").trim();
  if (fits(text)) return { text: narration.trim(), shortened: false };

  const sentence = /^.*?[.!?](?=\s|$)/.exec(text)?.[0]?.trim();
  if (
    sentence &&
    sentence.length < text.length &&
    fits(sentence) &&
    words(sentence).length >= 3
  ) {
    return { text: sentence, shortened: true };
  }
  const head = words(text).slice(0, DISPLAY_MAX_WORDS).join(" ");
  const marks = [...head.matchAll(/[,;:\u2013\u2014]/g)]
    .map((m) => m.index!)
    .reverse();
  for (const mark of marks) {
    const clause = head.slice(0, mark).replace(/[,;:\u2013\u2014\s]+$/, "");
    if (words(clause).length >= 4 && fits(clause)) {
      return { text: clause, shortened: true };
    }
  }
  return { text: narration.trim(), shortened: false };
}
