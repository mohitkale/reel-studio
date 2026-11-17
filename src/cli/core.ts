/**
 * The `reel-studio` command line (roadmap M7): pure parts. Argument parsing,
 * storyboard overrides, exit codes and message wording live here so they can be
 * tested without a running studio; `main.ts` does the input and output.
 */
import type { LintResult } from "@/storyboard";

/** 0 success, 2 invalid storyboard, 3 missing dependency, 4 render failure. */
export const EXIT = {
  ok: 0,
  usage: 1,
  invalid: 2,
  missing: 3,
  render: 4,
} as const;

export const FORMATS = ["9:16", "16:9", "1:1"] as const;
export const QUALITIES = ["draft", "standard", "high"] as const;

export interface RenderArgs {
  file: string;
  out?: string;
  format?: (typeof FORMATS)[number];
  theme?: string;
  quality: (typeof QUALITIES)[number];
  noVoice: boolean;
  json: boolean;
}

export class UsageError extends Error {}

/** Parse the arguments after `render` (or `lint`). `-` reads standard input. */
export function parseRenderArgs(argv: string[]): RenderArgs {
  const out: RenderArgs = {
    file: "",
    quality: "standard",
    noVoice: false,
    json: false,
  };
  const take = (i: number, flag: string): string => {
    const value = argv[i + 1];
    if (!value || value.startsWith("--"))
      throw new UsageError(`${flag} needs a value`);
    return value;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "-o" || arg === "--out") out.out = take(i++, arg);
    else if (arg === "--format") {
      const value = take(i++, arg);
      if (!(FORMATS as readonly string[]).includes(value))
        throw new UsageError(`--format must be one of ${FORMATS.join(", ")}`);
      out.format = value as RenderArgs["format"];
    } else if (arg === "--theme") out.theme = take(i++, arg);
    else if (arg === "--quality") {
      const value = take(i++, arg);
      if (!(QUALITIES as readonly string[]).includes(value))
        throw new UsageError(
          `--quality must be one of ${QUALITIES.join(", ")}`,
        );
      out.quality = value as RenderArgs["quality"];
    } else if (arg === "--no-voice") out.noVoice = true;
    else if (arg === "--json") out.json = true;
    else if (arg === "-" || !arg.startsWith("-")) {
      if (out.file) throw new UsageError(`Unexpected argument "${arg}"`);
      out.file = arg;
    } else throw new UsageError(`Unknown option ${arg}`);
  }
  if (!out.file) throw new UsageError("Give a storyboard file, or - for stdin");
  return out;
}

/** Apply command line overrides to a parsed storyboard object. */
export function applyOverrides(
  storyboard: unknown,
  args: Pick<RenderArgs, "format" | "theme" | "noVoice">,
): unknown {
  if (typeof storyboard !== "object" || storyboard === null) return storyboard;
  const next: Record<string, unknown> = { ...(storyboard as object) };
  if (args.format) next.format = args.format;
  if (args.theme) next.theme = args.theme;
  if (args.noVoice)
    next.voice = {
      ...((next.voice as Record<string, unknown> | undefined) ?? {}),
      enabled: false,
    };
  return next;
}

/** Plain-text lines for the lint errors: path, message, expected, example. */
export function describeErrors(lint: Pick<LintResult, "errors">): string[] {
  return lint.errors.flatMap((error) => [
    `✗ ${error.path || "(storyboard)"}: ${error.message}`,
    `    expected: ${error.expected}`,
    `    example:  ${error.example}`,
  ]);
}

/** A file name for the MP4 when `-o` is not given. */
export function defaultOutputName(title: string | undefined): string {
  const slug = (title ?? "video")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "video"}.mp4`;
}

/** One machine-readable progress line (`--json`). */
export function progressLine(event: Record<string, unknown>): string {
  return JSON.stringify(event);
}
