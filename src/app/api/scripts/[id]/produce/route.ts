import { randomUUID } from "node:crypto";

import { after, NextResponse } from "next/server";
import { z } from "zod";

import { produceReelAudio } from "@/library/produce-reel-service";
import { getScript } from "@/library/repositories/scripts";
import { generateTake } from "@/library/take-service";
import { getVoiceJob, upsertVoiceJob } from "@/lib/voice-queue";
import { PROVIDER_IDS } from "@/providers/voice/types";
import { authorizeProviderRequest } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  providerId: z.enum(PROVIDER_IDS).optional(),
  voiceId: z.string().optional(),
  /** When false, only fill BGM/SFX — never start VO. Default true. */
  startVoice: z.boolean().optional(),
});

/** POST /api/scripts/[id]/produce — one-click BGM + SFX + optional VO job. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const body = bodySchema.parse(await req.json().catch(() => ({})));
    await authorizeProviderRequest(
      req,
      body.startVoice === false ? [] : [body.providerId ?? "kokoro-server"],
    );

    const audio = await produceReelAudio(id);
    let voiceJobId: string | null = null;

    if (audio.needsVoice && body.startVoice !== false) {
      voiceJobId = randomUUID();
      upsertVoiceJob({
        id: voiceJobId,
        status: "queued",
        scene: 0,
        sceneCount: 0,
      });
      const jobId = voiceJobId;
      const providerId = body.providerId ?? "kokoro-server";
      const voiceId = body.voiceId ?? "af_heart";

      after(() =>
        generateTake({
          scriptId: id,
          providerId,
          voiceId,
          label: "Produce reel",
          onProgress: (progress) => {
            upsertVoiceJob({
              id: jobId,
              status: progress.phase,
              scene: progress.scene,
              sceneCount: progress.sceneCount,
              workingOn:
                progress.phase === "synthesizing"
                  ? progress.workingOn
                  : undefined,
            });
          },
        })
          .then((take) => {
            const last = getVoiceJob(jobId);
            upsertVoiceJob({
              id: jobId,
              status: "done",
              scene: take.timeline.length,
              sceneCount: last?.sceneCount ?? take.timeline.length,
              take,
            });
          })
          .catch((err) => {
            upsertVoiceJob({
              id: jobId,
              status: "error",
              scene: 0,
              sceneCount: 0,
              error: err instanceof Error ? err.message : String(err),
            });
          }),
      );
    }

    const script = await getScript(id);
    return NextResponse.json(
      {
        result: { ...audio, voiceJobId },
        script,
      },
      { status: voiceJobId ? 202 : 200 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
