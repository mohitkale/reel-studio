import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/library/db";
import { getScript } from "@/library/repositories/scripts";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const snapshotSchema = z.object({
  scenes: z.array(
    z.object({
      templateId: z.string().nullable(),
      text: z.string(),
      emphasis: z.array(z.string()),
      visual: z.string().nullable(),
    }),
  ),
});

/** Restore a script's scenes to a previously snapshotted state. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id: scriptId } = await ctx.params;
    const body = snapshotSchema.parse(await req.json());

    await prisma.scene.deleteMany({ where: { scriptId } });
    await prisma.scene.createMany({
      data: body.scenes.map((s, order) => ({
        scriptId,
        order,
        templateId: s.templateId ?? undefined,
        text: s.text,
        emphasis: s.emphasis.length ? JSON.stringify(s.emphasis) : null,
        visual: s.visual,
      })),
    });

    const updated = await getScript(scriptId);
    return NextResponse.json({ script: updated });
  } catch (e) {
    return errorResponse(e);
  }
}
