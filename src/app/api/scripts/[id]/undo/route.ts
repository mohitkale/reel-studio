import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/library/db";
import { getScript } from "@/library/repositories/scripts";
import {
  assetRefsSchema,
  sceneBackgroundSchema,
  sceneLocksSchema,
  sceneMoodSchema,
} from "@/library/schemas";
import { productionChartDataSchema } from "@/production/spec";
import { productionSceneRoleSchema } from "@/production/roles";
import { authorize } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sceneSnapshotSchema = z.object({
  id: z.string().min(1).optional(),
  templateId: z.string().nullable(),
  text: z.string(),
  spokenText: z.string().nullable().optional(),
  emphasis: z.array(z.string()),
  visual: z.string().nullable(),
  background: sceneBackgroundSchema.nullable().optional(),
  items: z.array(z.string().max(280)).max(24).optional(),
  chart: productionChartDataSchema.optional(),
  mood: sceneMoodSchema.optional(),
  musicMood: z.string().max(60).optional(),
  role: productionSceneRoleSchema.optional(),
  assetRefs: assetRefsSchema.optional(),
  locks: sceneLocksSchema.optional(),
  hideText: z.boolean().nullable().optional(),
  selectedVoiceClipId: z.string().nullable().optional(),
});

const snapshotSchema = z.object({
  scenes: z.array(sceneSnapshotSchema),
});
type SceneSnapshot = z.infer<typeof sceneSnapshotSchema>;

function layoutJsonFor(scene: SceneSnapshot): string | null {
  const config: Record<string, unknown> = {};
  if (scene.background) config.background = scene.background;
  if (scene.items?.length) config.items = scene.items;
  if (scene.chart) config.chart = scene.chart;
  if (scene.mood) config.mood = scene.mood;
  if (scene.musicMood) config.musicMood = scene.musicMood;
  if (scene.role) config.role = scene.role;
  if (scene.locks) config.locks = scene.locks;
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
    const script = await getScript(scriptId);
    if (!script) {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }

    const hasIds = body.scenes.some((scene) => scene.id !== undefined);
    if (hasIds && body.scenes.some((scene) => scene.id === undefined)) {
      return NextResponse.json(
        {
          error: "Scene snapshots must either all include ids or all omit them",
        },
        { status: 400 },
      );
    }

    if (hasIds) {
      const snapshotIds = body.scenes.map((scene) => scene.id!);
      if (new Set(snapshotIds).size !== snapshotIds.length) {
        return NextResponse.json(
          { error: "Scene snapshot contains duplicate ids" },
          { status: 400 },
        );
      }
      const currentById = new Map(
        script.scenes.map((scene) => [scene.id, scene]),
      );
      if (snapshotIds.some((id) => !currentById.has(id))) {
        return NextResponse.json(
          { error: "Scene snapshot does not belong to this script" },
          { status: 400 },
        );
      }
      const clipIds = body.scenes
        .map((scene) => scene.selectedVoiceClipId)
        .filter((id): id is string => Boolean(id));
      if (clipIds.length) {
        const clips = await prisma.sceneVoiceClip.findMany({
          where: { id: { in: clipIds }, scriptId },
          select: { id: true, sceneId: true },
        });
        const clipSceneById = new Map(
          clips.map((clip) => [clip.id, clip.sceneId]),
        );
        if (
          body.scenes.some(
            (scene) =>
              scene.selectedVoiceClipId &&
              clipSceneById.get(scene.selectedVoiceClipId) !== scene.id,
          )
        ) {
          return NextResponse.json(
            { error: "Selected voice clip does not belong to its scene" },
            { status: 400 },
          );
        }
      }

      await prisma.$transaction([
        ...body.scenes.map((snapshot, order) => {
          return prisma.scene.update({
            where: { id: snapshot.id! },
            data: {
              order,
              templateId: snapshot.templateId ?? undefined,
              text: snapshot.text,
              spokenText: snapshot.spokenText ?? null,
              emphasis: snapshot.emphasis.length
                ? JSON.stringify(snapshot.emphasis)
                : null,
              visual: snapshot.visual,
              layoutJson: layoutJsonFor(snapshot),
              assetRefs: snapshot.assetRefs?.length
                ? JSON.stringify(snapshot.assetRefs)
                : null,
              hideText: snapshot.hideText ?? null,
              selectedVoiceClipId: snapshot.selectedVoiceClipId ?? null,
            },
          });
        }),
        prisma.scene.deleteMany({
          where: { scriptId, id: { notIn: snapshotIds } },
        }),
      ]);
    } else {
      await prisma.$transaction([
        prisma.scene.deleteMany({ where: { scriptId } }),
        prisma.scene.createMany({
          data: body.scenes.map((scene, order) => ({
            scriptId,
            order,
            templateId: scene.templateId ?? undefined,
            text: scene.text,
            spokenText: scene.spokenText ?? null,
            emphasis: scene.emphasis.length
              ? JSON.stringify(scene.emphasis)
              : null,
            visual: scene.visual,
            layoutJson: layoutJsonFor(scene),
            assetRefs: scene.assetRefs?.length
              ? JSON.stringify(scene.assetRefs)
              : null,
            hideText: scene.hideText ?? null,
          })),
        }),
      ]);
    }

    const updated = await getScript(scriptId);
    return NextResponse.json({ script: updated });
  } catch (e) {
    return errorResponse(e);
  }
}
