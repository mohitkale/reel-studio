import { prisma } from "@/library/db";
import { submitEditorVoice } from "@/library/editor-jobs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { listSceneClipsForScene } from "@/library/repositories/scene-clips";
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
    return NextResponse.json({ clips: await listSceneClipsForScene(id) });
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

/** Generate one scene voice clip (async job). */
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

    const scene = await prisma.scene.findUniqueOrThrow({ where: { id } });
    const jobId = await submitEditorVoice({
      operation: "scene",
      resourceId: id,
      ...body,
      scriptId: scene.scriptId,
    });

    return NextResponse.json({ jobId }, { status: 202 });
  } catch (e) {
    return errorResponse(e);
  }
}
