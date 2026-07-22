import { randomUUID } from "node:crypto";

import { after, NextResponse } from "next/server";
import { z } from "zod";

import { listSceneClips } from "@/library/repositories/scene-clips";
import { generateAllSceneClips } from "@/library/scene-voice-service";
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
    return NextResponse.json({ clips: await listSceneClips(id) });
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
 * Generate a new voice clip for every scene in parallel, select each newest
 * clip, and assemble a VoiceTake. Returns 202 + jobId; progress via SSE.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const { id } = await ctx.params;
    const body = generateSchema.parse(await req.json().catch(() => ({})));

    const jobId = randomUUID();
    upsertVoiceJob({ id: jobId, status: "queued", scene: 0, sceneCount: 0 });

    after(() =>
      generateAllSceneClips({
        scriptId: id,
        ...body,
        onProgress: (progress) => {
          upsertVoiceJob({
            id: jobId,
            status: progress.phase,
            scene: progress.scene,
            sceneCount: progress.sceneCount,
            workingOn:
              progress.phase === "synthesizing" ? progress.workingOn : undefined,
          });
        },
      })
        .then(({ take, clips }) => {
          const last = getVoiceJob(jobId);
          upsertVoiceJob({
            id: jobId,
            status: "done",
            scene: clips.length,
            sceneCount: last?.sceneCount ?? clips.length,
            take: take ?? undefined,
            clips,
          });
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[scene-clips] generateAllSceneClips failed:", message);
          upsertVoiceJob({
            id: jobId,
            status: "error",
            scene: 0,
            sceneCount: 0,
            error: message,
          });
        }),
    );

    return NextResponse.json({ jobId }, { status: 202 });
  } catch (e) {
    return errorResponse(e);
  }
}
