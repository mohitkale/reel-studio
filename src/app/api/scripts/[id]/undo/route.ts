import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/library/db";
import { getScript } from "@/library/repositories/scripts";
import { authorize } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const backgroundSchema = z.object({
  type: z.enum(["image", "video"]),
  url: z.string().min(1).max(2048),
  effect: z
    .enum(["ken-burns", "pan-left", "pan-right", "pan-up", "pan-down"])
    .optional(),
  muted: z.boolean().optional(),
});

const sceneMoodSchema = z.enum([
  "energetic",
  "calm",
  "dramatic",
  "playful",
  "inspiring",
  "tech",
  "nature",
]);

const snapshotSchema = z.object({
  scenes: z.array(
    z.object({
      templateId: z.string().nullable(),
      text: z.string(),
      spokenText: z.string().nullable().optional(),
      emphasis: z.array(z.string()),
      visual: z.string().nullable(),
      background: backgroundSchema.nullable().optional(),
      items: z.array(z.string().max(280)).max(24).optional(),
      mood: sceneMoodSchema.optional(),
      musicMood: z.string().max(60).optional(),
    }),
  ),
});

function layoutJsonFor(scene: {
  background?: z.infer<typeof backgroundSchema> | null;
  items?: string[];
  mood?: string;
  musicMood?: string;
}): string | null {
  const config: Record<string, unknown> = {};
  if (scene.background) config.background = scene.background;
  if (scene.items && scene.items.length) config.items = scene.items;
  if (scene.mood) config.mood = scene.mood;
  if (scene.musicMood) config.musicMood = scene.musicMood;
  return Object.keys(config).length ? JSON.stringify(config) : null;
}

/** Restore a script's scenes to a previously snapshotted state. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const { id: scriptId } = await ctx.params;
    const body = snapshotSchema.parse(await req.json());

    await prisma.scene.deleteMany({ where: { scriptId } });
    await prisma.scene.createMany({
      data: body.scenes.map((s, order) => ({
        scriptId,
        order,
        templateId: s.templateId ?? undefined,
        text: s.text,
        spokenText: s.spokenText ?? null,
        emphasis: s.emphasis.length ? JSON.stringify(s.emphasis) : null,
        visual: s.visual,
        layoutJson: layoutJsonFor(s),
      })),
    });

    const updated = await getScript(scriptId);
    return NextResponse.json({ script: updated });
  } catch (e) {
    return errorResponse(e);
  }
}
