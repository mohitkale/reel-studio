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
import { drainProductionQueue } from "@/library/production-worker";
import { submitProductionBatch } from "@/library/production-batch-service";
import { productionBatchView } from "@/library/production-batch-view";
import { defaultVoiceForLanguage } from "@/providers/voice/voice-catalog";
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
    const shorts: Array<Record<string, unknown>> = [];
    const created: Array<{
      summary: {
        title: string;
        seconds: number;
        fromScene: number;
        toScene: number;
        hookRewritten?: boolean;
      };
      storyboard: (typeof picked)[number]["storyboard"];
      scriptId: string;
      projectId: string;
    }> = [];
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
      // The editable project is made now; the batch below makes every short together.
      const made = await produceFromStoryboard(storyboard, {
        quality: body.quality,
        createOnly: true,
        auth,
        serverBaseUrl: new URL(req.url).origin,
      });
      if (made.dryRun || !made.scriptId)
        throw new ProviderError("A short could not be created", 500);
      created.push({
        summary,
        storyboard,
        scriptId: made.scriptId,
        projectId: made.projectId,
      });
    }
    if (body.preview) return NextResponse.json({ shorts }, { status: 200 });

    // One batch for all the shorts: one id to ask about, one status, one bundle.
    const batch = await submitProductionBatch({
      request: {
        idempotencyKey: `shorts:${randomUUID()}`,
        runMode: "automatic",
        priority: 0,
        rows: created.map(({ storyboard, scriptId, summary }, index) => {
          const voice =
            storyboard.kind === "video" ? storyboard.voice : undefined;
          return {
            kind: "video" as const,
            key: `short-${index + 1}`,
            label: summary.title.slice(0, 120),
            scriptId,
            orientations: ["portrait" as const],
            quality: body.quality,
            captions:
              storyboard.kind === "video" && storyboard.captions === "off"
                ? ("off" as const)
                : ("auto" as const),
            quickProduce: {
              enabled: true,
              planner: "deterministic" as const,
              mediaPreference: "none" as const,
              voice: {
                enabled: voice?.enabled !== false,
                providerId: "kokoro-server" as const,
                voiceId:
                  voice?.voiceId ??
                  defaultVoiceForLanguage(storyboard.language) ??
                  "af_heart",
                ...(voice?.speed !== undefined ? { speed: voice.speed } : {}),
                ...(voice?.style ? { style: voice.style } : {}),
                ...(storyboard.kind === "video" &&
                storyboard.beatSync === "auto"
                  ? { beatSync: true }
                  : {}),
              },
            },
          };
        }),
      },
      auth,
      serverBaseUrl: new URL(req.url).origin,
    });
    const view = productionBatchView(batch);
    const queued = view.items.filter((item) => item.state === "queued").length;
    if (queued)
      after(() =>
        drainProductionQueue({
          workerId: `web-cutdowns:${randomUUID()}`,
          execute: executeProductionJob,
          maxJobs: queued,
        }),
      );
    created.forEach((short, index) => {
      const item = view.items.find((i) => i.rowIndex === index);
      shorts.push({
        ...short.summary,
        jobId: item?.job?.id ?? null,
        projectId: short.projectId,
      });
    });
    return NextResponse.json(
      { batchId: view.id, state: view.state, shorts },
      { status: 202 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
