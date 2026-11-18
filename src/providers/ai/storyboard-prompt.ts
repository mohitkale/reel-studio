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
- chapters: only for a video over about three minutes. Mark where each chapter starts with its title and startScene, start every chapter with a scene that names it, and bring the viewer back with a hook, stat, quote or comparison every minute or so.
- publish: a title, a one or two sentence description, up to ten hashtags and three to six big words of thumbnailText for posting. Leave out what you are unsure of.
- Use the requested format and tone, and write in the language of the brief.`;

/**
 * A shorter prompt for models with a small context window or about four billion
 * parameters or fewer: the same rules in fewer words, so the JSON Schema and the
 * brief keep most of the window. Used with the two-step writer.
 */
export const COMPACT_WRITER_PROMPT = `You write one storyboard for Reel Studio. Reply with one JSON object that matches the JSON Schema, and nothing else.

- Scene one is a hook. One idea per scene. A headline is at most seven words.
- Narration is short spoken sentences. Never repeat the headline.
- Use only facts from the brief or notes. Never invent numbers, quotes or sources.
- Scene types: hook, statement, list (items), stat (stat), quote (quote), code (code), media (media with a query), cta. Do not use the same type three times in a row. End with a cta.
- About 2.5 spoken words per second of the target length.
- Do not describe layout, colour, motion or timing.
- Write in the language of the brief.`;

/**
 * The prompt for a spoken episode: a conversation, not an article read aloud.
 * Pasted into any chat app the same way as the video prompt.
 */
export const PODCAST_WRITER_PROMPT = `You write one podcast episode for Reel Studio. Reply with a single JSON object that matches the supplied JSON Schema, and nothing else. kind is "podcast".

Craft
- It must sound spoken. Short turns, usually one to three sentences. Contractions, reactions ("Right.", "Huh, I didn't know that."), real questions and answers.
- Never read a list aloud. Turn points into a back and forth: one speaker asks, the other explains, then a follow-up.
- The host opens by welcoming the listener and naming the topic in one sentence, and closes with one clear takeaway and a thanks.
- Speakers address each other by name now and then, not every turn.
- Be concrete: use real numbers, names and examples from the brief or research notes. Never invent statistics, quotes or sources. If a fact is not in the brief or notes, leave it out.
- Length: about 2.5 spoken words per second of the target length.

Cast
- One speaker for a solo narration (id "host"), two for a conversation (ids "host" and "guest"). Give each a first name. Use only voice names from the voice list when you set voiceId, otherwise leave it out.
- Every turn's speaker is the id of one of the speakers.

Rules
- Do not describe music, sound effects or pauses; they are added later.
- sources: only pages listed in the research notes, each with its title, url and the date accessed.
- publish: a title, a one or two sentence description and up to ten hashtags for the episode listing. Leave out what you are unsure of.
- Write in the language of the brief.`;

/** Pass one for a long video: plan the chapters before any scene is written. */
export const OUTLINE_WRITER_PROMPT = `You plan a long video for Reel Studio. Reply with a single JSON object that matches the supplied JSON Schema, and nothing else.

- Plan the chapters of one video, in order. Each chapter has a short title and a goal: what it explains and which concrete facts, numbers or examples it uses.
- The first chapter hooks the viewer and says what the video will cover. The last chapter ends with a payoff and a call to action.
- Chapters build on each other; none repeats another. Aim for chapters of about two to three minutes.
- Be concrete: use real numbers, names and examples from the brief or research notes. Never invent statistics, quotes or sources.
- Write in the language of the brief.`;

export interface StoryboardBrief {
  /** "podcast" asks for a spoken episode; the default is a video. */
  kind?: "video" | "podcast";
  /** Podcast: 1 for a solo narration, 2 for a conversation. Default 2. */
  hosts?: 1 | 2;
  /** The topic or idea, or the full source text to turn into a video. */
  topic: string;
  audience?: string;
  /** Target length in seconds. Defaults to 60. */
  targetSeconds?: number;
  format?: "9:16" | "16:9" | "1:1";
  tone?: string;
  /** Use the shorter prompt (small models and small context windows). */
  compact?: boolean;
  /**
   * Change an existing storyboard instead of writing a new one. The writer gets
   * the current storyboard and the instruction, and keeps everything else as is.
   */
  revise?: { storyboard: unknown; instruction: string };
  /** Facts and pages the writer may use. Nothing outside these is stated as fact. */
  researchNotes?: Array<{
    title: string;
    url?: string;
    accessed?: string;
    notes: string;
  }>;
}

export function buildOutlineMessages(
  brief: StoryboardBrief,
  chapterCount: number,
): { system: string; user: string } {
  return {
    system: OUTLINE_WRITER_PROMPT,
    user: JSON.stringify({
      task: "Plan the chapters for this video.",
      brief: {
        topic: brief.topic,
        audience: brief.audience ?? "a general audience",
        targetSeconds: brief.targetSeconds ?? 600,
        chapters: chapterCount,
        tone: brief.tone ?? "clear and friendly",
        ...(brief.researchNotes?.length
          ? { researchNotes: brief.researchNotes }
          : {}),
      },
    }),
  };
}

export function buildStoryboardMessages(brief: StoryboardBrief): {
  system: string;
  user: string;
} {
  if (brief.revise) {
    return {
      system: STORYBOARD_WRITER_PROMPT,
      user: JSON.stringify({
        task: "Change the current storyboard as the instruction says and return the complete new storyboard as one JSON object. Keep every scene, headline and narration the instruction does not mention exactly as it is. Do not add facts that are not already in the storyboard or the instruction.",
        instruction: brief.revise.instruction,
        currentStoryboard: brief.revise.storyboard,
      }),
    };
  }
  if (brief.kind === "podcast") {
    return {
      system: PODCAST_WRITER_PROMPT,
      user: JSON.stringify({
        task: "Write the podcast storyboard for this brief.",
        brief: {
          topic: brief.topic,
          audience: brief.audience ?? "a general audience",
          targetSeconds: brief.targetSeconds ?? 180,
          speakers: brief.hosts ?? 2,
          tone: brief.tone ?? "warm and curious",
          ...(brief.researchNotes?.length
            ? { researchNotes: brief.researchNotes }
            : {}),
        },
      }),
    };
  }
  return {
    system: brief.compact ? COMPACT_WRITER_PROMPT : STORYBOARD_WRITER_PROMPT,
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
  const original = JSON.parse(first.user) as Record<string, unknown>;
  return {
    system: first.system,
    user: JSON.stringify({
      task: "Your previous reply could not be used. Fix exactly these problems and return the complete corrected storyboard as one JSON object.",
      ...(brief.revise
        ? {
            instruction: original.instruction,
            currentStoryboard: original.currentStoryboard,
          }
        : { brief: original.brief }),
      previousReply: previousReply.slice(0, 12_000),
      problems,
    }),
  };
}
