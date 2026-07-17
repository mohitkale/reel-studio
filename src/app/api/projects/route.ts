import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createProject,
  ensureSampleSeed,
  listProjects,
} from "@/library/repositories/projects";
import { orientationSchema } from "@/lib/orientation";
import { VIDEO_ENGINE_IDS } from "@/engines/types";
import { authorize } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  orientation: orientationSchema.optional(),
  videoEngine: z.enum(VIDEO_ENGINE_IDS).optional(),
});

export async function GET() {
  try {
    await ensureSampleSeed();
    return NextResponse.json({ projects: await listProjects() });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    authorize(req);
    const { name, orientation, videoEngine } = createSchema.parse(
      await req.json(),
    );
    return NextResponse.json(
      await createProject(name, orientation, videoEngine),
      { status: 201 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
