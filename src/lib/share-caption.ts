/**
 * A post caption and hashtags built from the storyboard's own words. Plain code,
 * no AI: the same video always gives the same text.
 */
const STOP = new Set(
  (
    "about after again also because been before being between both could does doing down during each from have " +
    "here into just like make more most much must only other over really should some such than that their them then " +
    "there these they this those through very want were what when where which while will with would your yours " +
    "you're it's don't can't"
  ).split(" "),
);

export interface CaptionSource {
  title: string;
  scenes: { headline?: string; narration?: string }[];
}

export interface ShareCaption {
  caption: string;
  hashtags: string[];
  text: string;
}

function words(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
    (word) => word.length > 3 && !STOP.has(word) && !/^\d+$/.test(word),
  );
}

export function buildShareCaption(
  source: CaptionSource,
  maxTags = 5,
): ShareCaption {
  const hook = source.scenes.find((s) => s.headline?.trim())?.headline?.trim();
  const caption =
    hook && hook.toLowerCase() !== source.title.trim().toLowerCase()
      ? `${source.title.trim()}. ${hook}`
      : source.title.trim();
  // Title words count triple so the topic leads; ties keep first-seen order.
  const counts = new Map<string, number>();
  const add = (text: string, weight: number) =>
    words(text).forEach((w) => counts.set(w, (counts.get(w) ?? 0) + weight));
  add(source.title, 3);
  source.scenes.forEach((s) =>
    add(`${s.headline ?? ""} ${s.narration ?? ""}`, 1),
  );
  const hashtags = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTags)
    .map(([w]) => `#${w[0].toUpperCase()}${w.slice(1)}`);
  return {
    caption,
    hashtags,
    text: [caption, hashtags.join(" ")].filter(Boolean).join("\n\n"),
  };
}
