import { randomUUID } from "node:crypto";

import { after, NextResponse } from "next/server";
import { z } from "zod";

import { authorizeProviderRequest, authorizeRequest } from "@/server/auth";
import { getAIProvider } from "@/providers/ai/registry";
import { writeStoryboard } from "@/providers/ai/storyboard-writer";
import { AI_PROVIDER_IDS } from "@/providers/ai/types";
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
    /**
     * Ask a storyboard writer to sharpen each short's opening line. The writer may
     * change only the first scene's headline and narration; if it fails, the short
     * keeps its plain-code hook.
     */
    writer: z
      .object({
        providerId: z.enum(AI_PROVIDER_IDS),
        modelId: z.string().min(1).max(200).optional(),
      })
      .strict()
      .optional(),
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
    const provider = body.writer ? getAIProvider(body.writer.providerId) : null;
    if (body.writer && provider) {
      await authorizeProviderRequest(req, [body.writer.providerId]);
      if (!provider.isConfigured())
        throw new ProviderError(
          `${provider.label} is not configured. Check Settings.`,
          400,
        );
    }
    const shorts = [];
    for (const short of picked) {
      let storyboard = short.storyboard;
      let hookRewritten = false;
      if (provider && !body.preview) {
        try {
          const written = await writeStoryboard({
            provider,
            modelId: body.writer?.modelId,
            signal: req.signal,
            brief: {
              topic: "Sharpen the opening of this short",
              revise: {
                storyboard,
                instruction:
                  "Rewrite only the first scene's headline and narration as a stronger opening for a short clip: a question or a bold, true claim, at most twelve spoken words. Keep every other scene exactly as it is and add no new facts.",
              },
            },
          });
          const first =
            written.storyboard?.kind === "video"
              ? written.storyboard.scenes[0]
              : undefined;
          if (first && storyboard.kind === "video") {
            storyboard = {
              ...storyboard,
              scenes: [
                {
                  ...storyboard.scenes[0]!,
                  headline: first.headline,
                  narration: first.narration,
                },
                ...storyboard.scenes.slice(1),
              ],
            };
            hookRewritten = true;
          }
        } catch {
          // The plain-code hook stays.
        }
      }
      const summary = {
        title: short.storyboard.title,
        seconds: short.seconds,
        ...(provider ? { hookRewritten } : {}),
        fromScene: short.from,
        toScene: short.to,
      };
      if (body.preview) {
        shorts.push(summary);
        continue;
      }
      const made = await produceFromStoryboard(storyboard, {
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
