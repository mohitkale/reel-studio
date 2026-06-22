import { z } from "zod";

/** Zod schemas for JSON-shaped DB columns and API inputs. */

export const beatTimingSchema = z.object({
  sceneId: z.string(),
  startFrame: z.number().int().nonnegative(),
  durationFrames: z.number().int().nonnegative(),
  text: z.string(),
});

export const timelineSchema = z.array(beatTimingSchema);

export const emphasisSchema = z.array(z.string());

export const paletteSchema = z.object({
  background: z.string().optional(),
  backgroundAccent: z.string().optional(),
  foreground: z.string().optional(),
  muted: z.string().optional(),
  accent: z.string().optional(),
  accentSecondary: z.string().optional(),
  accentForeground: z.string().optional(),
});

export const fontsSchema = z.object({
  fontFamily: z.string().optional(),
});

export const metaSchema = z.record(z.unknown());

/** Parse a JSON string column, falling back to a default on null/invalid. */
export function parseJsonColumn<T>(
  raw: string | null | undefined,
  schema: z.ZodType<T>,
  fallback: T,
): T {
  if (!raw) return fallback;
  try {
    const result = schema.safeParse(JSON.parse(raw));
    return result.success ? result.data : fallback;
  } catch {
    return fallback;
  }
}
