import { z } from "zod";

import { authorizeProviderRequest } from "@/server/auth";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";
import { getAIProvider, isAIProviderId } from "@/providers/ai/registry";
import { writeStoryboardWithResearch } from "@/providers/ai/storyboard-writer";
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
    /** `auto` researches the topic first when the provider can search the web. */
    research: z.enum(["auto", "off"]).default("auto"),
    /** The topic is your own source text, so nothing is looked up. */
    fromSourceText: z.boolean().default(false),
  })
  .strict();

/**
 * POST /api/storyboards/write: ask a configured AI provider to write a
 * Storyboard v1 from a brief, then lint and repair the reply. Writes nothing
 * and renders nothing; post the returned storyboard to `POST /api/storyboards`
 * to produce the video. This is the only AI step in the pipeline. With a
 * web-search provider (Gemini, OpenAI) and `research: "auto"` (the default) one
 * grounded research call runs first and its real URLs become `sources`.
 */
export async function POST(req: Request) {
  try {
    const body = parseClientInput(bodySchema, await readRequestJson(req));
    await authorizeProviderRequest(req, [body.providerId]);
    const searches =
      body.research === "auto" &&
      !body.fromSourceText &&
      (body.providerId === "gemini" || body.providerId === "openai");
    // The research call is a second paid request for a token with an allowance.
    if (searches) await authorizeProviderRequest(req, [body.providerId]);
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
    const result = await writeStoryboardWithResearch({
      provider,
      brief: body.brief,
      modelId: body.modelId,
      retry: body.retry,
      research: body.research,
      hasSourceText: body.fromSourceText,
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
      research: result.research,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
