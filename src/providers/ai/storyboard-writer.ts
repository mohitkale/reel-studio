import {
  lintStoryboard,
  type LintOptions,
  type LintResult,
} from "@/storyboard";

import {
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
  attempts: 1 | 2;
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
export async function writeStoryboard(args: {
  provider: AIProvider;
  brief: StoryboardBrief;
  modelId?: string;
  signal?: AbortSignal;
  /** Skip the retry, for example to keep a paid provider to one call. */
  retry?: boolean;
  lint?: LintOptions;
}): Promise<StoryboardWriteResult> {
  const { provider } = args;
  if (!provider.completeStructured) {
    throw new AIError(
      `${provider.label} cannot write storyboards yet`,
      400,
      provider.id,
    );
  }
  const options: LintOptions = {
    minSeconds: args.lint?.minSeconds ?? (args.brief.targetSeconds ?? 60) * 0.6,
    maxSeconds: args.lint?.maxSeconds ?? (args.brief.targetSeconds ?? 60) * 1.5,
    ...args.lint,
  };
  const call = (messages: { system: string; user: string }) =>
    provider.completeStructured!({
      ...messages,
      modelId: args.modelId,
      signal: args.signal,
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
