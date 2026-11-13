/**
 * The one prompt that asks any model for a Storyboard v1. Plain text with no
 * internal ids: the model never sees templates, recipes or engine names. The
 * same text is published at docs/prompts/storyboard-writer.md so it can be
 * pasted into any chat app (`npm run storyboard:schema` regenerates that file).
 */
export const STORYBOARD_WRITER_PROMPT = `You write one storyboard for Reel Studio. Reply with a single JSON object that matches the supplied JSON Schema, and nothing else.

Craft
- Hook in the first three seconds: scene one is a hook that makes the viewer want the next line.
- One idea per scene. A headline is at most seven words, a complete phrase that is never cut off.
- Narration is spoken language: short sentences, natural contractions. Never repeat the headline word for word.
- Be concrete: use real numbers, names and examples from the brief or research notes. Never invent statistics, quotes or sources. If a fact is not in the brief or notes, leave it out.
- Vary the scene types and never use the same type three times in a row. End with a payoff: a cta, or a statement that closes the idea.
- Length: about 2.5 spoken words per second of the target length, so roughly 8 scenes for 60 seconds.

Scene types
- hook: the opening line that grabs attention.
- statement: one key idea.
- list: 2 to 6 short parallel points (needs items).
- stat: one big number (needs stat).
- chart: compare values, only when the brief gives exact numbers (needs chart).
- quote: a real, attributed quotation (needs quote).
- code: a short snippet for developer topics (needs code).
- media: a picture or clip carries the scene (needs media with a plain-words query).
- cta: the closing call to action.

Rules
- Layout, colour, motion, timing and transitions are decided later. Do not describe them.
- sources: only pages listed in the research notes, each with its title, url and the date accessed.
- Use the requested format and tone, and write in the language of the brief.`;

export interface StoryboardBrief {
  /** The topic or idea, or the full source text to turn into a video. */
  topic: string;
  audience?: string;
  /** Target length in seconds. Defaults to 60. */
  targetSeconds?: number;
  format?: "9:16" | "16:9" | "1:1";
  tone?: string;
  /** Facts and pages the writer may use. Nothing outside these is stated as fact. */
  researchNotes?: Array<{
    title: string;
    url?: string;
    accessed?: string;
    notes: string;
  }>;
}

export function buildStoryboardMessages(brief: StoryboardBrief): {
  system: string;
  user: string;
} {
  return {
    system: STORYBOARD_WRITER_PROMPT,
    user: JSON.stringify({
      task: "Write the storyboard for this brief.",
      brief: {
        topic: brief.topic,
        audience: brief.audience ?? "a general audience",
        targetSeconds: brief.targetSeconds ?? 60,
        format: brief.format ?? "9:16",
        tone: brief.tone ?? "clear and friendly",
        ...(brief.researchNotes?.length
          ? { researchNotes: brief.researchNotes }
          : {}),
      },
    }),
  };
}

/** The follow-up for the single allowed retry: the errors from the linter. */
export function buildRetryMessages(
  brief: StoryboardBrief,
  previousReply: string,
  problems: Array<{
    path: string;
    message: string;
    expected: string;
    example: string;
  }>,
): { system: string; user: string } {
  const first = buildStoryboardMessages(brief);
  return {
    system: first.system,
    user: JSON.stringify({
      task: "Your previous reply could not be used. Fix exactly these problems and return the complete corrected storyboard as one JSON object.",
      brief: JSON.parse(first.user).brief,
      previousReply: previousReply.slice(0, 12_000),
      problems,
    }),
  };
}
