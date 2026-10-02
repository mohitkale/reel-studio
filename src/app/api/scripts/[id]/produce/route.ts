import { submitEditorVoice } from "@/library/editor-jobs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { produceReelAudio } from "@/library/produce-reel-service";
import { getScript } from "@/library/repositories/scripts";
import { PROVIDER_IDS } from "@/providers/voice/types";
import { authorizeProviderRequest } from "@/server/auth";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";

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
    const body = parseClientInput(
      bodySchema,
      await readRequestJson(req, { allowEmpty: true }),
    );
    await authorizeProviderRequest(
      req,
      body.startVoice === false ? [] : [body.providerId ?? "kokoro-server"],
    );

    const audio = await produceReelAudio(id);
    let voiceJobId: string | null = null;

    if (audio.needsVoice && body.startVoice !== false) {
      voiceJobId = await submitEditorVoice({
        operation: "take",
        resourceId: id,
        providerId: body.providerId ?? "kokoro-server",
        voiceId: body.voiceId ?? "af_heart",
        label: "Produce reel",
      });
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
