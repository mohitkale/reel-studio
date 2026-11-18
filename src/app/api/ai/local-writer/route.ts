import { NextResponse } from "next/server";
import { z } from "zod";

import { authorizeRead, requireWeb } from "@/server/auth";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";
import {
  cancelModelPull,
  detectLocalWriter,
  startModelPull,
  selectLocalWriterModel,
} from "@/library/local-writer-setup";
import { LOCAL_AI_PROVIDER_IDS } from "@/providers/ai/local-definitions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai/local-writer: what is installed, what fits, and what to do next. */
export async function GET(req: Request) {
  try {
    authorizeRead(req);
    return NextResponse.json(await detectLocalWriter());
  } catch (error) {
    return errorResponse(error);
  }
}

const modelSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._\-/:]*$/, "That is not a model name.");

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pull"), model: modelSchema.optional() }),
  z.object({
    action: z.literal("use"),
    providerId: z.enum(LOCAL_AI_PROVIDER_IDS),
    model: modelSchema,
  }),
  z.object({ action: z.literal("cancel") }),
]);

/** POST /api/ai/local-writer: download the recommended model, select an installed one, or cancel. */
export async function POST(req: Request) {
  try {
    requireWeb(req);
    const body = parseClientInput(bodySchema, await readRequestJson(req));
    if (body.action === "pull") {
      const current = await detectLocalWriter();
      startModelPull(body.model ?? current.recommended.ollama);
    } else if (body.action === "use") {
      await selectLocalWriterModel(body.providerId, body.model);
    } else {
      cancelModelPull();
    }
    return NextResponse.json(await detectLocalWriter());
  } catch (error) {
    return errorResponse(error);
  }
}
