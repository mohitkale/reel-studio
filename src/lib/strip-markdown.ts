/**
 * Strip common inline markdown so spoken captions / TTS never read punctuation
 * like "asterisk great asterisk". Applied to AI-generated scene copy.
 */
export function stripMarkdown(text: string): string {
  return (
    text
      // Bold / italic (order matters: ** before *)
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      // Strikethrough, inline code
      .replace(/~~([^~]+)~~/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      // Stray emphasis markers the model sometimes leaves behind
      .replace(/[*~`]/g, "")
      // Keep underscores inside technical identifiers such as manual_review.
      .replace(/(?<![\p{L}\p{N}])_|_(?![\p{L}\p{N}])/gu, "")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}
