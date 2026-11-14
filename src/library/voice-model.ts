/**
 * Guided Kokoro model download (roadmap V8): one clear size and location, a
 * progress report, resume after an interruption, and a checksum check against
 * the hash the model host publishes. Plain HTTP with Range requests, no
 * dependency on the model library's own downloader, so it can be interrupted
 * and picked up again. Files land where the Kokoro runtime reads its cache, so
 * synthesis never touches the network afterwards.
 */
import { createHash } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

import { KOKORO_MODEL_ID } from "@/providers/voice/kokoro";

/** Files the quantized model needs (the voices ship inside `kokoro-js`). */
export const KOKORO_MODEL_FILES = [
  "config.json",
  "tokenizer_config.json",
  "tokenizer.json",
  "onnx/model_quantized.onnx",
] as const;

/** About 90 MB in total; the exact size comes from the host before downloading. */
export const KOKORO_APPROX_BYTES = 92_000_000;
export const MODEL_HOST = "https://huggingface.co";

export interface VoiceModelStatus {
  cached: boolean;
  location: string;
  files: Array<{ path: string; present: boolean }>;
}

export interface DownloadProgress {
  file: string;
  fileIndex: number;
  fileCount: number;
  bytesDone: number;
  bytesTotal: number;
}

/** Where the Kokoro runtime caches the model. */
export async function voiceModelCacheDir(): Promise<string> {
  const { env } = await import("@huggingface/transformers");
  return path.join(String(env.cacheDir), KOKORO_MODEL_ID);
}

export async function getVoiceModelStatus(
  cacheDir?: string,
): Promise<VoiceModelStatus> {
  const location = cacheDir ?? (await voiceModelCacheDir());
  const files = KOKORO_MODEL_FILES.map((file) => ({
    path: file,
    present: existsSync(path.join(location, file)),
  }));
  return { cached: files.every((f) => f.present), location, files };
}

interface RemoteFile {
  path: string;
  size: number;
  sha256?: string;
}

async function listRemoteFiles(
  host: string,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<RemoteFile[]> {
  const response = await fetchImpl(
    `${host}/api/models/${KOKORO_MODEL_ID}/tree/main?recursive=true`,
    { signal },
  );
  if (!response.ok)
    throw new Error(`The model host answered ${response.status}`);
  const entries = (await response.json()) as Array<{
    path: string;
    size?: number;
    lfs?: { oid?: string; size?: number };
  }>;
  return KOKORO_MODEL_FILES.map((file) => {
    const entry = entries.find((e) => e.path === file);
    if (!entry) throw new Error(`The model host has no ${file}`);
    return {
      path: file,
      size: entry.lfs?.size ?? entry.size ?? 0,
      ...(entry.lfs?.oid ? { sha256: entry.lfs.oid } : {}),
    };
  });
}

async function sha256Of(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

/**
 * Download what is missing. A partial file (`.part`) is continued with a Range
 * request; a finished file is verified against its published sha256 (size when
 * none is published) before it is renamed into place.
 */
export async function downloadVoiceModel(
  options: {
    cacheDir?: string;
    host?: string;
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
    onProgress?: (progress: DownloadProgress) => void;
  } = {},
): Promise<VoiceModelStatus> {
  const host = options.host ?? MODEL_HOST;
  const fetchImpl = options.fetchImpl ?? fetch;
  const cacheDir = options.cacheDir ?? (await voiceModelCacheDir());
  const remote = await listRemoteFiles(host, fetchImpl, options.signal);
  const total = remote.reduce((sum, f) => sum + f.size, 0);
  let done = 0;

  for (const [index, file] of remote.entries()) {
    const target = path.join(cacheDir, file.path);
    const part = `${target}.part`;
    mkdirSync(path.dirname(target), { recursive: true });
    if (existsSync(target) && (await verify(target, file))) {
      done += file.size;
      continue;
    }
    let have = existsSync(part) ? statSync(part).size : 0;
    if (have > file.size) have = 0;
    if (have < file.size || file.size === 0) {
      const response = await fetchImpl(
        `${host}/${KOKORO_MODEL_ID}/resolve/main/${file.path}`,
        {
          signal: options.signal,
          headers: have > 0 ? { Range: `bytes=${have}-` } : {},
        },
      );
      if (!response.ok || !response.body)
        throw new Error(`Could not download ${file.path} (${response.status})`);
      // A host that ignores Range sends the whole file: start over.
      const resumed = have > 0 && response.status === 206;
      if (!resumed) have = 0;
      const out = createWriteStream(part, { flags: resumed ? "a" : "w" });
      let received = have;
      const body = Readable.fromWeb(
        response.body as import("node:stream/web").ReadableStream,
      );
      body.on("data", (chunk: Buffer) => {
        received += chunk.length;
        options.onProgress?.({
          file: file.path,
          fileIndex: index,
          fileCount: remote.length,
          bytesDone: done + received,
          bytesTotal: total,
        });
      });
      await pipeline(body, out);
    }
    if (!(await verify(part, file))) {
      throw new Error(
        `${file.path} did not match the published checksum; delete ${part} and try again`,
      );
    }
    renameSync(part, target);
    done += file.size;
  }
  return getVoiceModelStatus(cacheDir);
}

async function verify(file: string, remote: RemoteFile): Promise<boolean> {
  if (remote.size > 0 && statSync(file).size !== remote.size) return false;
  return remote.sha256 ? (await sha256Of(file)) === remote.sha256 : true;
}
