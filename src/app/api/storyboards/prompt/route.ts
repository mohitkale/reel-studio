import { NextResponse } from "next/server";
import { z } from "zod";

import { buildStoryboardMessages } from "@/providers/ai/storyboard-prompt";
import { storyboardJsonSchema } from "@/storyboard";
import { authorizeRead } from "@/server/auth";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  topic: z.string().trim().min(1).max(20_000),
  targetSeconds: z.number().min(5).max(600).optional(),
  format: z.enum(["9:16", "16:9", "1:1"]).optional(),
  tone: z.string().trim().min(1).max(200).optional(),
});

/**
 * POST /api/storyboards/prompt: the writer prompt with the brief and the JSON
 * Schema filled in, as one text to paste into any chat assistant (no AI call is
 * made here). The reply goes back through the storyboard linter.
 */
export async function POST(req: Request) {
  try {
    authorizeRead(req);
    const brief = parseClientInput(bodySchema, await readRequestJson(req));
    const { system, user } = buildStoryboardMessages(brief);
    const prompt = `${system}\n\nBrief (JSON)\n${user}\n\nJSON Schema\n${JSON.stringify(storyboardJsonSchema())}\n\nReply with the JSON object only.`;
    return NextResponse.json({ prompt });
  } catch (error) {
    return errorResponse(error);
  }
}
