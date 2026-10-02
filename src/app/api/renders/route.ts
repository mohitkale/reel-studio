import { NextResponse } from "next/server";
import { z } from "zod";

import { listRenders } from "@/library/repositories/renders";
import { submitEditorRender } from "@/library/editor-render-jobs";
import { ORIENTATION_LABELS, orientationSchema } from "@/lib/orientation";
import { authorize, authorizeRead } from "@/server/auth";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";

const qualitySchema = z.enum(["draft", "standard", "high"]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    authorizeRead(req);
    const { searchParams } = new URL(req.url);
    const scriptId = searchParams.get("scriptId") ?? undefined;
    return NextResponse.json({ renders: await listRenders(scriptId) });
  } catch (e) {
    return errorResponse(e);
  }
}

const createSchema = z.object({
  scriptId: z.string().min(1),
  voiceTakeId: z.string().optional(),
  /** Repurpose the script into another format; omit to use its native orientation. */
  orientation: orientationSchema.optional(),
  /** Speed/resolution tradeoff; omit for "standard" (unchanged default). */
  quality: qualitySchema.optional(),
});

export async function POST(req: Request) {
  try {
    const origin = authorize(req);
    const body = parseClientInput(createSchema, await readRequestJson(req));

    // Label repurposed/non-standard-quality renders so the list is readable.
    const labelParts = [
      body.orientation ? ORIENTATION_LABELS[body.orientation] : null,
      body.quality && body.quality !== "standard"
        ? body.quality === "draft"
          ? "Draft"
          : "High quality"
        : null,
    ].filter(Boolean);
    const name = labelParts.length ? labelParts.join(" · ") : undefined;

    const render = await submitEditorRender({
      ...body,
      name,
      approval: origin === "mcp",
      serverBaseUrl: new URL(req.url).origin,
    });
    return NextResponse.json({ render }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
