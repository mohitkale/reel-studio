import { NextResponse } from "next/server";
import { z } from "zod";

import { getAIProvider, isAIProviderId } from "@/providers/ai/registry";
import { AIError, AI_PROVIDER_IDS, SCRIPT_STYLES } from "@/providers/ai/types";
import { getScript } from "@/library/repositories/scripts";
import { prisma } from "@/library/db";
import { resolveSceneBackgrounds } from "@/library/stock-backgrounds";
import { enrichScenePlan } from "@/library/enrich-scene-plan";
import { orientationFromDims } from "@/lib/orientation";
import { authorize } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import type { SceneBackground } from "@/compositions/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  providerId: z.enum(AI_PROVIDER_IDS),
  modelId: z.string().optional(),
  mode: z.enum(["rewrite", "append"]),
  brief: z.string().trim().min(3).max(4000),
  sceneCount: z.number().int().min(2).max(20).optional(),
  scriptStyle: z.enum(SCRIPT_STYLES).optional(),
});

/** Build the Scene.layoutJson payload from a resolved background + AI mood hints. */
function layoutJsonFor(
  background: SceneBackground | undefined,
  scene: { mood?: string; musicMood?: string; items?: string[] },
): string | null {
  const config: Record<string, unknown> = {};
  if (background) config.background = background;
  if (scene.mood) config.mood = scene.mood;
  if (scene.musicMood) config.musicMood = scene.musicMood;
  if (scene.items?.length) config.items = scene.items;
  return Object.keys(config).length ? JSON.stringify(config) : null;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
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
      .map((s, i) => {
        const spoken =
          s.spokenText && s.spokenText !== s.text
            ? ` | voice: ${s.spokenText}`
            : "";
        return `Scene ${i + 1}: ${s.text}${spoken}`;
      })
      .join("\n");

    const orientation = orientationFromDims(script.width, script.height);
    const raw = await provider.generatePlan({
      mode: body.mode,
      brief: body.brief,
      sceneCount: body.sceneCount,
      existingContext,
      existingSceneCount: script.scenes.length,
      modelId: body.modelId,
      orientation,
      scriptStyle: body.scriptStyle,
    });
    const plan = { ...raw, scenes: enrichScenePlan(raw.scenes) };

    // Best-effort stock backgrounds (no-op without an Unsplash key).
    const backgrounds = await resolveSceneBackgrounds(plan.scenes, orientation);

    if (body.mode === "rewrite") {
      await prisma.scene.deleteMany({ where: { scriptId } });
      await prisma.scene.createMany({
        data: plan.scenes.map((s, order) => ({
          scriptId,
          order,
          templateId: s.templateId,
          text: s.text,
          spokenText: s.spokenText ?? null,
          emphasis: s.emphasis.length ? JSON.stringify(s.emphasis) : null,
          visual: s.visual ?? null,
          layoutJson: layoutJsonFor(backgrounds[order], s),
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
          spokenText: s.spokenText ?? null,
          emphasis: s.emphasis.length ? JSON.stringify(s.emphasis) : null,
          visual: s.visual ?? null,
          layoutJson: layoutJsonFor(backgrounds[i], s),
        })),
      });
    }

    const updated = await getScript(scriptId);
    return NextResponse.json({ script: updated });
  } catch (e) {
    return errorResponse(e);
  }
}
