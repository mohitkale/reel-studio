import { randomUUID } from "node:crypto";

import { after, NextResponse } from "next/server";
import { z } from "zod";

import { authorizeRequest } from "@/server/auth";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";
import { executeProductionJob } from "@/library/production-job-executor";
import { runProductionWorkerOnce } from "@/library/production-worker";
import { projectToStoryboard } from "@/library/project-storyboard";
import { produceFromStoryboard } from "@/library/storyboard-production";
import { cutdowns } from "@/storyboard/cutdowns";
import { ProviderError } from "@/providers/voice/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    count: z.number().int().min(1).max(5).default(3),
    maxSeconds: z.number().min(10).max(90).default(45),
    quality: z.enum(["draft", "standard", "high"]).default("standard"),
    /** Only list the shorts; make nothing. */
    preview: z.boolean().default(false),
  })
  .strict();

/**
 * POST /api/scripts/:id/cutdowns: pick three to five self-contained runs of the
 * video, add a hook and a closing line, and make each a vertical short. The
 * choice is plain code (no AI), so the same video always gives the same shorts.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = authorizeRequest(req, "studio:write");
    const { id } = await params;
    const body = parseClientInput(
      bodySchema,
      await readRequestJson(req, { allowEmpty: true }),
    );
    const result = await projectToStoryboard(id);
    if (!result) throw new ProviderError("Script not found", 404);
    if (!result.storyboard || result.storyboard.kind !== "video")
      throw new ProviderError("This project cannot be cut into shorts", 422);
    const picked = cutdowns(result.storyboard, {
      count: body.count,
      maxSeconds: body.maxSeconds,
    });
    if (picked.length === 0)
      throw new ProviderError(
        "This video is too short to cut into shorts (it needs at least two scenes and about fifteen seconds in a run).",
        422,
      );
    const shorts = [];
    for (const short of picked) {
      const summary = {
        title: short.storyboard.title,
        seconds: short.seconds,
        fromScene: short.from,
        toScene: short.to,
      };
      if (body.preview) {
        shorts.push(summary);
        continue;
      }
      const made = await produceFromStoryboard(short.storyboard, {
        quality: body.quality,
        auth,
        serverBaseUrl: new URL(req.url).origin,
      });
      shorts.push({
        ...summary,
        jobId: made.dryRun ? null : made.jobId,
        projectId: made.dryRun ? null : made.projectId,
      });
    }
    if (!body.preview) {
      after(() =>
        runProductionWorkerOnce({
          workerId: `web-cutdowns:${randomUUID()}`,
          execute: executeProductionJob,
        }),
      );
    }
    return NextResponse.json({ shorts }, { status: body.preview ? 200 : 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
