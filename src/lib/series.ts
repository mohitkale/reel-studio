import { z } from "zod";

import { VOICE_STYLE_IDS } from "@/lib/voice-styles";

/**
 * A series (roadmap A7) is a saved set of defaults for videos that belong together:
 * the same look, voice, format, length and music every time. A storyboard that sets
 * a field itself keeps it; the series only fills in what the storyboard leaves out.
 */
export const seriesSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(/^[\p{L}\p{N} _-]+$/u, "Use letters, numbers, spaces, - and _"),
    theme: z.string().trim().min(1).max(40).optional(),
    format: z.enum(["9:16", "16:9", "1:1"]).optional(),
    /** Target length in seconds for the writer. */
    seconds: z.number().int().min(10).max(600).optional(),
    voiceId: z.string().trim().min(1).max(60).optional(),
    /** "auto", "none" or a bundled track id. */
    music: z.string().trim().min(1).max(40).optional(),
    narration: z.boolean().optional(),
    captions: z.boolean().optional(),
    tone: z.string().trim().max(120).optional(),
    /** A brand kit (colours, fonts, logo) every video in the series wears. */
    brandKitId: z.string().trim().min(1).max(80).optional(),
    /** A short chime at the start and the end of every video in the series. */
    stings: z.boolean().optional(),
    /** How the voice reads every video: calm, energetic, storyteller or news. */
    voiceStyle: z.enum(VOICE_STYLE_IDS).optional(),
    /** The language every video is written in (en-US, es, fr, ...). */
    language: z.string().trim().min(2).max(8).optional(),
  })
  .strict();
export type Series = z.infer<typeof seriesSchema>;

export const seriesListSchema = z.array(seriesSchema).max(50);

export function findSeries(
  list: readonly Series[] | undefined,
  name: string | undefined,
): Series | undefined {
  if (!name) return undefined;
  const wanted = name.trim().toLowerCase();
  return list?.find((s) => s.name.toLowerCase() === wanted);
}

/** Fill in what a storyboard leaves out; never overwrite what it sets. Returns a new object. */
export function applySeries(
  storyboard: Record<string, unknown>,
  series: Series,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...storyboard };
  const podcast = out.kind === "podcast";
  // "auto" means the writer left the choice open, so a series may fill it in.
  const open = (value: unknown) => value === undefined || value === "auto";
  if (!podcast) {
    if (series.format && out.format === undefined) out.format = series.format;
    if (series.theme && open(out.theme)) out.theme = series.theme;
    if (series.captions === false && out.captions === undefined)
      out.captions = "off";
  }
  if (series.music && open(out.music)) out.music = series.music;
  if (series.stings && out.stings === undefined) out.stings = "auto";
  if (series.language && out.language === undefined)
    out.language = series.language;
  const voice = (out.voice ?? {}) as Record<string, unknown>;
  if (
    !podcast &&
    (series.voiceId || series.voiceStyle || series.narration === false)
  ) {
    out.voice = {
      ...voice,
      ...(series.voiceId && voice.voiceId === undefined
        ? { voiceId: series.voiceId }
        : {}),
      ...(series.voiceStyle && voice.style === undefined
        ? { style: series.voiceStyle }
        : {}),
      ...(series.narration === false && voice.enabled === undefined
        ? { enabled: false }
        : {}),
    };
  }
  return out;
}

/**
 * Topics from pasted text: one per line, or the first column of a CSV. A header
 * line named "topic" is skipped; blank lines and repeats are dropped.
 */
export function parseTopics(text: string, max = 50): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line) continue;
    if (line.startsWith('"')) {
      const end = line.indexOf('"', 1);
      line = end > 0 ? line.slice(1, end) : line.slice(1);
    } else if (line.includes(",") && /^[^,]{1,200},/.test(line)) {
      line = line.slice(0, line.indexOf(","));
    }
    line = line.trim();
    if (!line || /^topics?$/i.test(line)) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line.slice(0, 500));
    if (out.length >= max) break;
  }
  return out;
}
