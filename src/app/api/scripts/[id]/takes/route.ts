import { submitEditorVoice } from "@/library/editor-jobs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { listTakes } from "@/library/repositories/takes";
import { PROVIDER_IDS } from "@/providers/voice/types";
import { authorizeProviderRequest, authorizeRead } from "@/server/auth";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRead(req);
    const { id } = await ctx.params;
    return NextResponse.json({ takes: await listTakes(id) });
  } catch (e) {
    return errorResponse(e);
  }
}

const generateSchema = z
  .object({
    placeholder: z.boolean().optional(),
    providerId: z.enum(PROVIDER_IDS).optional(),
    voiceId: z.string().optional(),
    modelId: z.string().optional(),
    label: z.string().max(120).optional(),
  })
  .default({});

/**
 * Kicks off voice generation as a background job and returns immediately with
 * a jobId instead of blocking the request until synthesis finishes — the
 * client polls/streams progress via GET .../takes/[jobId]/progress (SSE).
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = parseClientInput(
      generateSchema,
      await readRequestJson(req, { allowEmpty: true }),
    );
    await authorizeProviderRequest(
      req,
      body.placeholder || !body.providerId ? [] : [body.providerId],
    );

    const jobId = await submitEditorVoice({
      operation: "take",
      resourceId: id,
      ...body,
    });

    return NextResponse.json({ jobId }, { status: 202 });
  } catch (e) {
    return errorResponse(e);
  }
}
