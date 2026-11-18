/**
 * The one-prompt home screen's logic (roadmap U1): what a typed entry means and
 * what is sent to the storyboard writer. Pure, so it is tested without a page.
 */
export const FORMATS = [
  { id: "9:16", label: "Short", hint: "9:16" },
  { id: "16:9", label: "Video", hint: "16:9" },
  { id: "1:1", label: "Square", hint: "1:1" },
] as const;
export type FormatId = (typeof FORMATS)[number]["id"];

export const LENGTHS = [15, 30, 60] as const;
export type LengthSeconds = (typeof LENGTHS)[number];

/** Pasted text longer than this is the user's own script, not a topic. */
export const OWN_TEXT_WORDS = 150;

export const EXAMPLE_PROMPTS = [
  "Why the sky is blue, explained in thirty seconds",
  "Five Excel shortcuts that save an hour a week",
  "What really happens when you cancel a subscription",
] as const;

export type EntryKind = "empty" | "topic" | "own-text" | "url";

export function classifyEntry(text: string): EntryKind {
  const trimmed = text.trim();
  if (!trimmed) return "empty";
  if (/^https?:\/\/\S+$/i.test(trimmed)) return "url";
  const words = trimmed.split(/\s+/).length;
  return words > OWN_TEXT_WORDS ? "own-text" : "topic";
}

export interface WriteRequest {
  brief: {
    topic: string;
    targetSeconds: number;
    format: FormatId;
  };
  fromSourceText: boolean;
  research: "auto" | "off";
}

export function buildWriteRequest(
  text: string,
  options: { format: FormatId; seconds: number; research?: boolean },
): WriteRequest | null {
  const kind = classifyEntry(text);
  if (kind === "empty") return null;
  const topic =
    kind === "url"
      ? `Make a video that explains the page at ${text.trim()}. Read it first and keep the facts accurate.`
      : text.trim();
  return {
    brief: {
      topic,
      targetSeconds: options.seconds,
      format: options.format,
    },
    // Your own text is the source; a topic or a URL may be researched.
    fromSourceText: kind === "own-text",
    research:
      kind === "own-text" || options.research === false ? "off" : "auto",
  };
}

/** Apply the chosen theme and the narration, music and caption switches to a written storyboard. */
export function finishStoryboard(
  storyboard: Record<string, unknown>,
  options: {
    theme: string;
    narration: boolean;
    music?: boolean;
    /** A bundled track id; anything else (or "auto") leaves the choice to the theme. */
    musicTrack?: string;
    captions?: boolean;
  },
): Record<string, unknown> {
  return {
    ...storyboard,
    ...(options.theme !== "auto" ? { theme: options.theme } : {}),
    ...(options.music === false
      ? { music: "none" }
      : options.musicTrack && options.musicTrack !== "auto"
        ? { music: options.musicTrack }
        : {}),
    ...(options.captions === false ? { captions: "off" } : {}),
    ...(!options.narration
      ? {
          voice: {
            ...((storyboard.voice as Record<string, unknown> | undefined) ??
              {}),
            enabled: false,
          },
        }
      : {}),
  };
}

/** A tiny built-in storyboard, so a first video needs no AI provider. */
export const SAMPLE_STORYBOARD = {
  version: 1,
  title: "Reel Studio in thirty seconds",
  format: "9:16",
  theme: "auto",
  scenes: [
    {
      type: "hook",
      headline: "Videos from an idea, on your computer",
      narration:
        "What if a video could start with one sentence, and everything else happened on your own computer?",
    },
    {
      type: "steps",
      headline: "How it works",
      narration:
        "You describe the idea. A storyboard is written. Voice, scenes, captions and music are made locally.",
      items: [
        "Describe the idea",
        "Storyboard is written",
        "Everything renders locally",
      ],
    },
    {
      type: "cta",
      headline: "Try your own idea",
      narration: "Type your own idea on the home screen and press Create.",
    },
  ],
} as const;
