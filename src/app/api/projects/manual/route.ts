import { NextResponse } from "next/server";

import { createManualProject } from "@/library/manual-creation-service";
import { manualCreationSchema } from "@/production/manual-planner";
import { authorize } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Create an editable production from supplied content without an AI provider. */
export async function POST(req: Request) {
  try {
    authorize(req);
    const parsed = manualCreationSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid production request", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(await createManualProject(parsed.data), {
      status: 201,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
