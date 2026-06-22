import { NextResponse } from "next/server";
import { z } from "zod";

import { getAIProvider, isAIProviderId } from "@/providers/ai/registry";
import { AIError, AI_PROVIDER_IDS } from "@/providers/ai/types";
import { getScript } from "@/library/repositories/scripts";
import { prisma } from "@/library/db";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  providerId: z.enum(AI_PROVIDER_IDS),
  modelId: z.string().optional(),
  mode: z.enum(["rewrite", "append"]),
  brief: z.string().trim().min(3).max(4000),
  sceneCount: z.number().int().min(2).max(20).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id: scriptId } = await ctx.params;
    const body = bodySchema.parse(await req.json());

    if (!isAIProviderId(body.providerId)) {
      throw new AIError(`Unknown AI provider "${body.providerId}"`, 404);
    }

    const script = await getScript(scriptId);
    if (!script) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }

    const provider = getAIProvider(body.providerId);
    if (!provider.isConfigured()) {
      throw new AIError(
        `${provider.label} has no API key. Add one in Settings.`,
        400,
        body.providerId,
      );
    }

    const existingContext = script.scenes
      .map((s, i) => `Scene ${i + 1}: ${s.text}`)
      .join("\n");

    const plan = await provider.generatePlan({
      mode: body.mode,
      brief: body.brief,
      sceneCount: body.sceneCount,
      existingContext,
      existingSceneCount: script.scenes.length,
      modelId: body.modelId,
    });

    if (body.mode === "rewrite") {
      await prisma.scene.deleteMany({ where: { scriptId } });
      await prisma.scene.createMany({
        data: plan.scenes.map((s, order) => ({
          scriptId,
          order,
          templateId: s.templateId,
          text: s.text,
          emphasis: s.emphasis.length ? JSON.stringify(s.emphasis) : null,
          visual: s.visual ?? null,
        })),
      });
    } else {
      const startOrder = script.scenes.length;
      await prisma.scene.createMany({
        data: plan.scenes.map((s, i) => ({
          scriptId,
          order: startOrder + i,
          templateId: s.templateId,
          text: s.text,
          emphasis: s.emphasis.length ? JSON.stringify(s.emphasis) : null,
          visual: s.visual ?? null,
        })),
      });
    }

    const updated = await getScript(scriptId);
    return NextResponse.json({ script: updated });
  } catch (e) {
    return errorResponse(e);
  }
}
