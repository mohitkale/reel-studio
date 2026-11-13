import { z } from "zod";

import { authorizeProviderRequest } from "@/server/auth";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";
import { getAIProvider, isAIProviderId } from "@/providers/ai/registry";
import { writeStoryboard } from "@/providers/ai/storyboard-writer";
import { AI_PROVIDER_IDS, AIError } from "@/providers/ai/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    providerId: z.enum(AI_PROVIDER_IDS),
    modelId: z.string().min(1).max(200).optional(),
    brief: z
      .object({
        topic: z.string().trim().min(1).max(20_000),
        audience: z.string().trim().min(1).max(200).optional(),
        targetSeconds: z.number().min(5).max(600).optional(),
        format: z.enum(["9:16", "16:9", "1:1"]).optional(),
        tone: z.string().trim().min(1).max(200).optional(),
        researchNotes: z
          .array(
            z.object({
              title: z.string().trim().min(1).max(200),
              url: z.url({ protocol: /^https?$/ }).optional(),
              accessed: z
                .string()
                .regex(/^\d{4}-\d{2}-\d{2}$/)
                .optional(),
              notes: z.string().trim().min(1).max(8_000),
            }),
          )
          .max(12)
          .optional(),
      })
      .strict(),
    /** Allow the single retry (a second paid call on a cloud provider). Default true. */
    retry: z.boolean().default(true),
  })
  .strict();

/**
 * POST /api/storyboards/write: ask a configured AI provider to write a
 * Storyboard v1 from a brief, then lint and repair the reply. Writes nothing
 * and renders nothing; post the returned storyboard to `POST /api/storyboards`
 * to produce the video. This is the only AI step in the pipeline.
 */
export async function POST(req: Request) {
  try {
    const body = parseClientInput(bodySchema, await readRequestJson(req));
    const auth = await authorizeProviderRequest(req, [body.providerId]);
    void auth;
    if (!isAIProviderId(body.providerId)) {
      throw new AIError(`Unknown AI provider "${body.providerId}"`, 404);
    }
    const provider = getAIProvider(body.providerId);
    if (!provider.isConfigured()) {
      throw new AIError(
        `${provider.label} is not configured. Check Settings.`,
        400,
        body.providerId,
      );
    }
    const result = await writeStoryboard({
      provider,
      brief: body.brief,
      modelId: body.modelId,
      retry: body.retry,
      signal: req.signal,
    });
    return Response.json({
      ok: result.errors.length === 0,
      providerId: body.providerId,
      modelId: body.modelId ?? null,
      attempts: result.attempts,
      storyboard: result.storyboard,
      fixes: result.fixes,
      warnings: result.warnings,
      errors: result.errors,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
