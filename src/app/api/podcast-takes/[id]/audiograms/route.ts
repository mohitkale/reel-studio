import { randomUUID } from "node:crypto";

import { after, NextResponse } from "next/server";
import { z } from "zod";

import { orientationSchema } from "@/lib/orientation";
import { enqueueProductionJob } from "@/library/repositories/production-jobs";
import { runProductionWorkerOnce } from "@/library/production-worker";
import { executeProductionJob } from "@/library/production-job-executor";
import { requireWeb } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  startTurnId: z.string().min(1),
  endTurnId: z.string().min(1),
  orientation: orientationSchema.default("portrait"),
  quality: z.enum(["draft", "standard", "high"]).default("standard"),
  idempotencyKey: z.string().min(8).max(240).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    requireWeb(req);
    const { id: takeId } = await ctx.params;
    const body = bodySchema.parse(await req.json());
    const job = await enqueueProductionJob({
      kind: "audiogram",
      idempotencyKey: body.idempotencyKey ?? `audiogram:${randomUUID()}`,
      inputSnapshot: {
        takeId,
        startTurnId: body.startTurnId,
        endTurnId: body.endTurnId,
        orientation: body.orientation,
        quality: body.quality,
      },
    });
    after(() =>
      runProductionWorkerOnce({
        workerId: `web-audiogram:${randomUUID()}`,
        execute: executeProductionJob,
      }),
    );
    return NextResponse.json({ jobId: job.id }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
