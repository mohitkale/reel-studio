import { type NextRequest, NextResponse } from "next/server";

import { getAssetStore } from "@/library/storage";
import { authorizeMedia } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import { parseByteRange } from "@/server/byte-range";
import type { ReadableAsset } from "@/library/storage/types";

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
 * Preview players (and native <audio>) can seek; without this, playback audio
 * sync fails with "media cannot be seeked".
 *
 * Access is same-origin / loopback / MCP-token gated — never world-readable on
 * a LAN or public bind.
 */
async function serve(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
  head = false,
) {
  try {
    authorizeMedia(req);
  } catch (e) {
    return errorResponse(e);
  }

  const { path: segments } = await ctx.params;
  const key = segments.join("/");

  let asset: ReadableAsset;
  try {
    asset = await getAssetStore().open(key);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  // Never serve SVG as image/svg+xml (scriptable). Treat as downloadable bytes.
  const contentType =
    ext === "svg"
      ? "application/octet-stream"
      : (CONTENT_TYPES[ext] ?? "application/octet-stream");
  const total = asset.size;
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  // Range applies to GET only; HEAD describes the complete representation.
  const range = head ? null : req.headers.get("range");
  const bounds = range ? parseByteRange(range, total) : undefined;
  if (bounds === null) {
    await asset.close();
    return new NextResponse(null, {
      status: 416,
      headers: { ...headers, "Content-Range": `bytes */${total}`, "Content-Length": "0" },
    });
  }
  const start = bounds?.start ?? 0;
  const end = bounds?.end ?? total - 1;
  headers["Content-Length"] = String(bounds ? end - start + 1 : total);
  if (bounds) headers["Content-Range"] = `bytes ${start}-${end}/${total}`;
  if (head) {
    await asset.close();
    return new NextResponse(null, { headers });
  }
  try {
    return new NextResponse(asset.stream({ start, end, signal: req.signal }), {
      status: bounds ? 206 : 200,
      headers,
    });
  } catch (error) {
    await asset.close();
    return errorResponse(error);
  }
}

export const GET = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => serve(req, ctx);
export const HEAD = (req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) => serve(req, ctx, true);
