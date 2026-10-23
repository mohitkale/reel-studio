import type { PodcastPronunciation } from "@/library/podcast-schemas";

/** Literal ordered substitutions; never interprets user input as regex. */
export function applyPronunciations(
  text: string,
  rules: PodcastPronunciation[],
): string {
  return rules.reduce(
    (value, rule) =>
      value.replace(
        new RegExp(
          rule.find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          rule.caseSensitive ? "g" : "gi",
        ),
        () => rule.replaceWith,
      ),
    text,
  );
}
