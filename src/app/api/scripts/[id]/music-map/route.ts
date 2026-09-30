import { NextResponse } from "next/server";
import { analyzeMusicMap, editMusicMap } from "@/library/music-map-service";
import { getScript } from "@/library/repositories/scripts";
import { musicMapEditSchema } from "@/production/music-map";
import { authorize } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function POST(req: Request, ctx: Context) {
  try {
    if (authorize(req) === "mcp")
      return NextResponse.json(
        { error: "Analyze music in the editor." },
        { status: 403 },
      );
    const { id } = await ctx.params;
    const map = await analyzeMusicMap(id, new URL(req.url).origin);
    return NextResponse.json({ map, script: await getScript(id) });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(req: Request, ctx: Context) {
  try {
    authorize(req);
    const body = musicMapEditSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!body.success)
      return NextResponse.json(
        { error: "Invalid music timing edit", issues: body.error.issues },
        { status: 400 },
      );
    const { id } = await ctx.params;
    const map = await editMusicMap(id, body.data, new URL(req.url).origin);
    return NextResponse.json({ map, script: await getScript(id) });
  } catch (error) {
    return errorResponse(error);
  }
}
