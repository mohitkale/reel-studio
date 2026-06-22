import { NextResponse } from "next/server";
import { z } from "zod";

import { listBrandKits, createBrandKit } from "@/library/repositories/brandkits";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({ name: z.string().min(1).max(80) });

export async function GET() {
  try {
    const kits = await listBrandKits();
    return NextResponse.json(kits);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = createSchema.parse(await req.json());
    const kit = await createBrandKit(body.name);
    return NextResponse.json(kit, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
