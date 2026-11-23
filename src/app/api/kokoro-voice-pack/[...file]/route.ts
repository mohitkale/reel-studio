import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import {
  ensureInstalledVoicePack,
  isInstalledVoicePack,
} from "@/library/installed-voice-pack";
import { errorResponse } from "@/server/api-helpers";
import { authorizeRead } from "@/server/auth";

export const runtime = "nodejs";

const assetTypes = new Map([
  ["client.mjs", "text/javascript"],
  ["wasm/ort-wasm-simd-threaded.jsep.mjs", "text/javascript"],
  ["wasm/ort-wasm-simd-threaded.jsep.wasm", "application/wasm"],
]);
const modelPrefix = "models/onnx-community/Kokoro-82M-v1.0-ONNX/";
for (const name of ["config.json", "tokenizer.json", "tokenizer_config.json"])
  assetTypes.set(modelPrefix + name, "application/json");
assetTypes.set(
  modelPrefix + "onnx/model_quantized.onnx",
  "application/octet-stream",
);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ file: string[] }> },
) {
  try {
    authorizeRead(req);
    const relative = (await params).file.join("/");
    const contentType = assetTypes.get(relative);
    if (!contentType || !isInstalledVoicePack())
      return new Response("Voice pack asset not found", { status: 404 });
    const file = path.join(await ensureInstalledVoicePack(), relative);
    const info = await stat(file);
    if (!info.isFile())
      return new Response("Voice pack asset not found", { status: 404 });
    const stream = Readable.toWeb(
      createReadStream(file, { signal: req.signal }),
    );
    return new Response(stream as ReadableStream<Uint8Array>, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(info.size),
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
