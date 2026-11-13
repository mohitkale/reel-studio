import { z } from "zod";

import { authorizeRead } from "@/server/auth";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";
import { lintStoryboard } from "@/storyboard/lint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const optionsSchema = z
  .object({
    minSeconds: z.number().positive().max(3600).optional(),
    maxSeconds: z.number().positive().max(3600).optional(),
  })
  .strict();

/**
 * Lint and auto-repair a storyboard. Pure and read-only: nothing is saved, no
 * model is called. Body: the storyboard (object), or
 * `{ storyboard: <object | reply text>, options?: { minSeconds, maxSeconds } }`.
 * Always 200 with `{ ok, storyboard, fixes, warnings, errors }`; invalid
 * storyboards return `ok: false` and actionable `errors`.
 */
export async function POST(req: Request) {
  try {
    authorizeRead(req);
    const body = await readRequestJson(req);
    const wrapped =
      typeof body === "object" &&
      body !== null &&
      !Array.isArray(body) &&
      "storyboard" in body &&
      !("scenes" in body) &&
      !("turns" in body);
    const record = body as Record<string, unknown>;
    const options = wrapped
      ? parseClientInput(optionsSchema, record.options ?? {})
      : {};
    const result = lintStoryboard(wrapped ? record.storyboard : body, options);
    return Response.json({ ok: result.errors.length === 0, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
