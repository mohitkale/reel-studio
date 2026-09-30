import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureSfxCues, setSfxEnabled } from "@/library/sfx-service";
import { editSfxCue } from "@/library/sfx-cue-edit-service";
import { sfxCueEditRequestSchema } from "@/lib/sfx-cue-edit";
import { getScript } from "@/library/repositories/scripts";
import { authorize } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  force: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

/** Refresh automatic SFX suggestions, preserving creator edits, or toggle SFX. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const { id } = await ctx.params;
    const body = bodySchema.parse(await req.json().catch(() => ({})));

    if (body.enabled === false) {
      await setSfxEnabled(id, false);
      const script = await getScript(id);
      return NextResponse.json({
        result: { attached: false, reason: "disabled" },
        script,
      });
    }

    if (body.enabled === true) {
      await setSfxEnabled(id, true);
    }

    const result = await ensureSfxCues(id, {
      force: body.force,
      enabled: body.enabled,
    });
    if (!result.attached && result.reason === "not_found") {
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    }
    const script = await getScript(id);
    return NextResponse.json({ result, script });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Adjust one cue while leaving narration, music and other cues intact. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    authorize(req);
    const body = sfxCueEditRequestSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!body.success)
      return NextResponse.json(
        { error: "Invalid cue edit", issues: body.error.issues },
        { status: 400 },
      );
    const { id } = await ctx.params;
    const result = await editSfxCue(id, body.data);
    if (result.state === "not_found")
      return NextResponse.json({ error: "Script not found" }, { status: 404 });
    if (result.state === "conflict")
      return NextResponse.json(
        { error: "This cue changed. Review the latest cues and try again." },
        { status: 409 },
      );
    if (result.state === "invalid_timing")
      return NextResponse.json(
        {
          error:
            "Use a shift of up to two seconds for a motion cue, or a nonnegative scene offset.",
        },
        { status: 400 },
      );
    return NextResponse.json({ script: await getScript(id) });
  } catch (error) {
    return errorResponse(error);
  }
}
