import { z } from "zod";
import {
  lintStoryboard,
  type LintOptions,
  type LintResult,
} from "@/storyboard";

import {
  buildOutlineMessages,
  buildRetryMessages,
  buildStoryboardMessages,
  type StoryboardBrief,
} from "./storyboard-prompt";
import {
  constrainSources,
  researchForStoryboard,
  type ResearchCache,
  type ResearchOutcome,
  type ResearchRunner,
  type ResearchSetting,
} from "@/research/storyboard-research";
import { AIError, type AIProvider } from "./types";

export interface StoryboardWriteResult extends LintResult {
  /** How many model calls were made: 1, or 2 after the single allowed retry. */
  attempts: number;
  /** The model's last raw reply. */
  reply: string;
}

/** Models that must emit every key (strict structured output) send null for the optional ones. */
function withoutNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutNulls);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => [k, withoutNulls(v)]),
    );
  }
  return value;
}

function lintReply(reply: string, options: LintOptions): LintResult {
  let input: unknown = reply;
  try {
    input = withoutNulls(JSON.parse(reply));
  } catch {
    // Not pure JSON (a fence or prose): the linter extracts it.
  }
  return lintStoryboard(input, options);
}

/**
 * Ask a provider for a Storyboard v1 with its native structured output, then
 * lint and repair the reply. At most one retry, fed with the linter's errors.
 */
/** From this length a video is planned in two passes: chapters first, then scenes per chapter. */
export const LONG_FORM_SECONDS = 240;
const CHAPTER_SECONDS = 150;

const outlineSchema = z.object({
  title: z.string().min(1),
  chapters: z
    .array(z.object({ title: z.string().min(1), goal: z.string().default("") }))
    .min(2)
    .max(12),
});

function parseOutline(reply: string) {
  const text = reply.trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = outlineSchema.safeParse(
      withoutNulls(JSON.parse(text.slice(start, end + 1))),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

type WriteArgs = {
  provider: AIProvider;
  brief: StoryboardBrief;
  modelId?: string;
  signal?: AbortSignal;
  /** Skip the retry, for example to keep a paid provider to one call. */
  retry?: boolean;
  lint?: LintOptions;
  /** Plan a long video in one call instead of chapter by chapter. */
  longForm?: boolean;
};

/**
 * A long video in two passes so each model call stays inside its limits: one call
 * plans the chapters, then one call writes each chapter's scenes. It is still one
 * storyboard writer step to the person. Costs one call for the outline plus one per
 * chapter (a paid provider is charged for each).
 */
async function writeLongStoryboard(
  args: WriteArgs,
): Promise<StoryboardWriteResult> {
  const { provider, brief } = args;
  const total = brief.targetSeconds ?? LONG_FORM_SECONDS;
  const chapterCount = Math.min(
    12,
    Math.max(3, Math.round(total / CHAPTER_SECONDS)),
  );
  const ask = (
    messages: { system: string; user: string },
    kind: "outline" | "video",
  ) =>
    provider.completeStructured!({
      ...messages,
      modelId: args.modelId,
      signal: args.signal,
      kind,
    });

  let calls = 1;
  let outlineReply = await ask(
    buildOutlineMessages(brief, chapterCount),
    "outline",
  );
  let outline = parseOutline(outlineReply);
  if (!outline && args.retry !== false) {
    calls++;
    outlineReply = await ask(
      {
        ...buildOutlineMessages(brief, chapterCount),
        user: JSON.stringify({
          task: "Your previous reply was not a usable outline. Return the outline as one JSON object with a title and at least two chapters, each with a title and a goal.",
          brief: JSON.parse(buildOutlineMessages(brief, chapterCount).user)
            .brief,
          previousReply: outlineReply.slice(0, 4000),
        }),
      },
      "outline",
    );
    outline = parseOutline(outlineReply);
  }
  if (!outline)
    throw new AIError(
      "The writer did not return a usable chapter outline. Try again, or use a shorter length.",
      502,
      provider.id,
    );

  const perChapter = Math.round(total / outline.chapters.length);
  const scenes: Record<string, unknown>[] = [];
  const marks: { title: string; startScene: number }[] = [];
  const sources = new Map<string, unknown>();
  let head: Record<string, unknown> | undefined;
  for (const [index, chapter] of outline.chapters.entries()) {
    const others = outline.chapters
      .filter((_, i) => i !== index)
      .map((c) => c.title)
      .join("; ");
    const result = await writeStoryboard({
      ...args,
      longForm: false,
      brief: {
        ...brief,
        kind: "video",
        targetSeconds: perChapter,
        topic: `${brief.topic}\n\nYou are writing chapter ${index + 1} of ${outline.chapters.length} of a longer video titled "${outline.title}". This chapter: "${chapter.title}". ${chapter.goal}\nThe other chapters are: ${others}. Write only this chapter's scenes; do not repeat the others.${index > 0 ? " Do not open with a hook for the whole video." : ""}${index < outline.chapters.length - 1 ? " Do not close the whole video." : ""}`,
      },
      lint: {
        ...args.lint,
        minSeconds: perChapter * 0.4,
        maxSeconds: perChapter * 2.2,
      },
    });
    calls += result.attempts;
    if (!result.storyboard || result.storyboard.kind !== "video")
      return {
        ...result,
        attempts: calls,
        reply: result.reply,
        errors: result.errors.map((error) => ({
          ...error,
          path: `chapters.${index}.${error.path}`,
        })),
      };
    const board = result.storyboard;
    head ??= board as unknown as Record<string, unknown>;
    marks.push({ title: chapter.title, startScene: scenes.length });
    // Chapters after the first open with a card that names them.
    if (index > 0)
      scenes.push({
        type: "statement",
        headline: chapter.title,
        narration: `Chapter ${index + 1}. ${chapter.title}.`,
      });
    scenes.push(...(board.scenes as unknown as Record<string, unknown>[]));
    for (const source of board.sources ?? []) sources.set(source.url, source);
  }
  const {
    scenes: _scenes,
    chapters: _chapters,
    sources: _sources,
    ...rest
  } = head as Record<string, unknown>;
  void _scenes;
  void _chapters;
  void _sources;
  const draft = {
    ...rest,
    title: outline.title,
    ...(sources.size ? { sources: [...sources.values()] } : {}),
    chapters: marks,
    scenes,
  };
  const options: LintOptions = {
    minSeconds: args.lint?.minSeconds ?? total * 0.6,
    maxSeconds: args.lint?.maxSeconds ?? total * 1.5,
    ...args.lint,
  };
  const final = lintReply(JSON.stringify(draft), options);
  return { ...final, attempts: calls, reply: JSON.stringify(draft) };
}

export async function writeStoryboard(
  args: WriteArgs,
): Promise<StoryboardWriteResult> {
  const { provider } = args;
  if (!provider.completeStructured) {
    throw new AIError(
      `${provider.label} cannot write storyboards yet`,
      400,
      provider.id,
    );
  }
  if (
    args.longForm !== false &&
    args.brief.kind !== "podcast" &&
    !args.brief.revise &&
    (args.brief.targetSeconds ?? 0) >= LONG_FORM_SECONDS
  )
    return writeLongStoryboard(args);
  const target =
    args.brief.targetSeconds ?? (args.brief.kind === "podcast" ? 180 : 60);
  const options: LintOptions = {
    minSeconds: args.lint?.minSeconds ?? target * 0.6,
    maxSeconds: args.lint?.maxSeconds ?? target * 1.5,
    ...args.lint,
  };
  const call = (messages: { system: string; user: string }) =>
    provider.completeStructured!({
      ...messages,
      modelId: args.modelId,
      signal: args.signal,
      kind: args.brief.kind ?? "video",
    });

  const firstReply = await call(buildStoryboardMessages(args.brief));
  const first = lintReply(firstReply, options);
  if (first.errors.length === 0 || args.retry === false) {
    return { ...first, attempts: 1, reply: firstReply };
  }
  const secondReply = await call(
    buildRetryMessages(args.brief, firstReply, first.errors),
  );
  const second = lintReply(secondReply, options);
  return { ...second, attempts: 2, reply: secondReply };
}

export interface ResearchedStoryboardResult extends StoryboardWriteResult {
  research: Pick<
    ResearchOutcome,
    "status" | "note" | "cached" | "providerCalls"
  > & {
    sources: number;
  };
}

/**
 * Research first when the provider can search the web (setting `auto`, the
 * default), then write. The brief carries the grounded notes; the finished
 * storyboard's `sources` can only hold URLs that came from grounding or from
 * the caller.
 */
export async function writeStoryboardWithResearch(
  args: Parameters<typeof writeStoryboard>[0] & {
    research?: ResearchSetting;
    /** The topic is the user's own source text, so no lookup is needed. */
    hasSourceText?: boolean;
    researchCache?: ResearchCache;
    researchRunner?: ResearchRunner;
  },
): Promise<ResearchedStoryboardResult> {
  const outcome = await researchForStoryboard({
    providerId: args.provider.id,
    topic: args.brief.topic,
    setting: args.research ?? "auto",
    hasSourceText: args.hasSourceText,
    cache: args.researchCache,
    runner: args.researchRunner,
    signal: args.signal,
  });
  const suppliedNotes = args.brief.researchNotes ?? [];
  const brief = {
    ...args.brief,
    researchNotes: [...suppliedNotes, ...outcome.notes].slice(0, 12),
  };
  const result = await writeStoryboard({ ...args, brief });
  const allowed = [
    ...outcome.sources,
    ...suppliedNotes.flatMap((n) =>
      n.url
        ? [
            {
              title: n.title,
              url: n.url,
              accessed: n.accessed ?? new Date().toISOString().slice(0, 10),
            },
          ]
        : [],
    ),
  ];
  const storyboard = result.storyboard
    ? constrainSources(result.storyboard, allowed)
    : null;
  return {
    ...result,
    storyboard,
    research: {
      status: outcome.status,
      note: outcome.note,
      cached: outcome.cached,
      providerCalls: outcome.providerCalls,
      sources: storyboard?.sources?.length ?? 0,
    },
  };
}
