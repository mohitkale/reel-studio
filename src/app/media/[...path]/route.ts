import { type NextRequest, NextResponse } from "next/server";

import { getAssetStore } from "@/library/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  json: "application/json",
};

/** GET /media/<key> - stream a stored asset from the active AssetStore. */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await ctx.params;
  const key = segments.join("/");

  try {
    const data = await getAssetStore().get(key);
    const ext = key.split(".").pop()?.toLowerCase() ?? "";
    const body = new Uint8Array(data);
    return new NextResponse(body, {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Content-Length": String(data.length),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
