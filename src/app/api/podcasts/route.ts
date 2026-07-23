import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createPodcast,
  listPodcasts,
} from "@/library/repositories/podcasts";
import { podcastLengthSchema } from "@/library/podcast-schemas";
import { authorize } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  length: podcastLengthSchema.optional(),
});

export async function GET() {
  try {
    return NextResponse.json({ podcasts: await listPodcasts() });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    authorize(req);
    const body = createSchema.parse(await req.json().catch(() => ({})));
    const podcast = await createPodcast(body);
    return NextResponse.json(podcast, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
