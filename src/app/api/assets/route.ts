import { NextResponse } from "next/server";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { listAssets, createAsset } from "@/library/repositories/assets";
import { getAssetStore } from "@/library/storage";
import { authorize, requireWeb } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Hard cap to reduce disk DoS from oversized uploads. */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME: Record<string, { type: string; ext: string }> = {
  "image/jpeg": { type: "image", ext: "jpg" },
  "image/png": { type: "image", ext: "png" },
  "image/gif": { type: "image", ext: "gif" },
  "image/webp": { type: "image", ext: "webp" },
  // SVG omitted: scriptable when served as image/svg+xml.
  "application/json": { type: "lottie", ext: "json" },
  "video/mp4": { type: "video", ext: "mp4" },
  "video/webm": { type: "video", ext: "webm" },
  "video/quicktime": { type: "video", ext: "mov" },
  "audio/mpeg": { type: "audio", ext: "mp3" },
  "audio/mp3": { type: "audio", ext: "mp3" },
  "audio/wav": { type: "audio", ext: "wav" },
  "audio/x-wav": { type: "audio", ext: "wav" },
  "audio/ogg": { type: "audio", ext: "ogg" },
  "audio/aac": { type: "audio", ext: "aac" },
  "audio/mp4": { type: "audio", ext: "m4a" },
};

const TYPE_FOLDER: Record<string, string> = {
  image: "images",
  lottie: "lottie",
  video: "videos",
  audio: "audio",
};

export async function GET(req: Request) {
  try {
    authorize(req);
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? undefined;
    const assets = await listAssets(type);
    return NextResponse.json(assets);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    requireWeb(req);
    const contentLength = Number(req.headers.get("content-length") ?? "0");
    if (contentLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB)` },
        { status: 413 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "file field required" }, { status: 400 });
    }

    const mime = file.type;
    const info = ALLOWED_MIME[mime];
    if (!info) {
      return NextResponse.json(
        { error: `Unsupported file type: ${mime || "unknown"}` },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB)` },
        { status: 413 },
      );
    }

    const id = randomUUID();
    const folder = TYPE_FOLDER[info.type] ?? "images";
    const storeKey = path.posix.join("assets", folder, `${id}.${info.ext}`);

    await getAssetStore().put(storeKey, buffer);

    const name = (formData.get("name") as string | null) ?? file.name ?? null;
    const asset = await createAsset(info.type, storeKey, name ?? undefined);

    return NextResponse.json(asset, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
