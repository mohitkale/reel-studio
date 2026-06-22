import { NextResponse } from "next/server";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { listAssets, createAsset } from "@/library/repositories/assets";
import { getAssetStore } from "@/library/storage";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_MIME: Record<string, { type: string; ext: string }> = {
  "image/jpeg": { type: "image", ext: "jpg" },
  "image/png": { type: "image", ext: "png" },
  "image/gif": { type: "image", ext: "gif" },
  "image/webp": { type: "image", ext: "webp" },
  "image/svg+xml": { type: "image", ext: "svg" },
  "application/json": { type: "lottie", ext: "json" },
};

export async function GET(req: Request) {
  try {
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
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "file field required" }, { status: 400 });
    }

    const mime = file.type;
    const info = ALLOWED_MIME[mime];
    if (!info) {
      return NextResponse.json(
        { error: `Unsupported file type: ${mime}` },
        { status: 400 },
      );
    }

    const id = randomUUID();
    const storeKey = path.posix.join("assets", info.type === "lottie" ? "lottie" : "images", `${id}.${info.ext}`);
    const buffer = Buffer.from(await file.arrayBuffer());

    await getAssetStore().put(storeKey, buffer);

    const name = (formData.get("name") as string | null) ?? file.name ?? null;
    const asset = await createAsset(info.type, storeKey, name ?? undefined);

    return NextResponse.json(asset, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
