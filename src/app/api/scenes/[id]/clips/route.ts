import { randomUUID } from "node:crypto";

import { after, NextResponse } from "next/server";
import { z } from "zod";

import { listSceneClipsForScene } from "@/library/repositories/scene-clips";
import { generateSceneClip } from "@/library/scene-voice-service";
import { PROVIDER_IDS } from "@/providers/voice/types";
import { getVoiceJob, upsertVoiceJob } from "@/lib/voice-queue";
import { authorize } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
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
    authorize(req);
    const { id } = await ctx.params;
    const body = generateSchema.parse(await req.json().catch(() => ({})));

    const jobId = randomUUID();
    upsertVoiceJob({
      id: jobId,
      status: "queued",
      scene: 0,
      sceneCount: 1,
    });

    after(() =>
      generateSceneClip({
        sceneId: id,
        ...body,
      })
        .then(({ clip, take }) => {
          upsertVoiceJob({
            id: jobId,
            status: "done",
            scene: 1,
            sceneCount: 1,
            clip,
            take: take ?? undefined,
          });
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[scene-clips] generateSceneClip failed:", message);
          upsertVoiceJob({
            id: jobId,
            status: "error",
            scene: 0,
            sceneCount: 1,
            error: message,
          });
        }),
    );

    return NextResponse.json({ jobId }, { status: 202 });
  } catch (e) {
    return errorResponse(e);
  }
}
