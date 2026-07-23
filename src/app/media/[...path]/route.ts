import { type NextRequest, NextResponse } from "next/server";

import { getAssetStore } from "@/library/storage";
import { authorizeMedia } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

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
  gif: "image/gif",
  json: "application/json",
};

/**
 * GET /media/<key> - stream a stored asset. Supports HTTP Range requests so the
 * Remotion Player (and native <audio>) can seek; without this, playback audio
 * sync fails with "media cannot be seeked".
 *
 * Access is same-origin / loopback / MCP-token gated — never world-readable on
 * a LAN or public bind.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  try {
    authorizeMedia(req);
  } catch (e) {
    return errorResponse(e);
  }

  const { path: segments } = await ctx.params;
  const key = segments.join("/");

  let data: Buffer;
  try {
    data = await getAssetStore().get(key);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  // Never serve SVG as image/svg+xml (scriptable). Treat as downloadable bytes.
  const contentType =
    ext === "svg"
      ? "application/octet-stream"
      : (CONTENT_TYPES[ext] ?? "application/octet-stream");
  const total = data.length;
  const range = req.headers.get("range");

  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    let start = match && match[1] ? parseInt(match[1], 10) : 0;
    let end = match && match[2] ? parseInt(match[2], 10) : total - 1;
    if (Number.isNaN(start)) start = 0;
    if (Number.isNaN(end) || end >= total) end = total - 1;

    if (start > end || start >= total) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${total}` },
      });
    }

    const chunk = data.subarray(start, end + 1);
    return new NextResponse(new Uint8Array(chunk), {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunk.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(total),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
