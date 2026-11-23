import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { z } from "zod";

const MAX_DOWNLOAD = 180 * 1024 * 1024;
export const KOKORO_PACK_APPROX_BYTES = 135_000_000;
type PackDownloadOptions = {
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
};
const manifestSchema = z
  .object({
    version: z.string().regex(/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
const packSchema = z.record(
  z
    .string()
    .regex(/^[a-zA-Z0-9_-][a-zA-Z0-9_./-]*$/)
    .refine((key) =>
      key
        .split("/")
        .every((part) => part.length > 0 && part !== "." && part !== ".."),
    ),
  z.string(),
);
const installed = () => process.env.REEL_STUDIO_INSTALL_ROOT;
let installing: Promise<string> | undefined;

export function isInstalledVoicePack(): boolean {
  return Boolean(installed());
}

/** Decode only the pinned release archive into a new directory. */
export function unpackVoicePack(bytes: Buffer, expected: string) {
  if (createHash("sha256").update(bytes).digest("hex") !== expected)
    throw new Error("Kokoro voice pack checksum did not match this release");
  return packSchema.parse(
    JSON.parse(
      gunzipSync(bytes, {
        maxOutputLength: MAX_DOWNLOAD * 2,
      }).toString("utf8"),
    ),
  );
}

async function fetchPack(
  url: string,
  options: PackDownloadOptions,
): Promise<Buffer> {
  const timeout = AbortSignal.timeout(180_000);
  const signal = options.signal
    ? AbortSignal.any([timeout, options.signal])
    : timeout;
  const response = await fetch(url, { signal });
  if (!response.ok || !response.body)
    throw new Error(
      `Kokoro voice pack is unavailable (HTTP ${response.status})`,
    );
  const reader = response.body.getReader();
  const total =
    Number(response.headers.get("content-length")) || KOKORO_PACK_APPROX_BYTES;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.length;
      if (size > MAX_DOWNLOAD)
        throw new Error("Kokoro voice pack exceeds its download limit");
      chunks.push(next.value);
      options.onProgress?.(size, total);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return Buffer.concat(chunks, size);
}

async function packLocation(root: string) {
  const { version, sha256 } = manifestSchema.parse(
    JSON.parse(
      await readFile(path.join(root, "voice-pack-manifest.json"), "utf8"),
    ),
  );
  const cache = process.env.REEL_STUDIO_MODEL_CACHE_DIR;
  if (!cache) throw new Error("Kokoro model cache is unavailable");
  const target = path.join(cache, `kokoro-${sha256}`);
  return { cache, target, version, sha256 };
}

export async function installedVoicePackDirectory(): Promise<string> {
  const root = installed();
  if (!root)
    throw new Error(
      "Run the installed Reel Studio package to use a voice pack",
    );
  return (await packLocation(root)).target;
}

async function installPack(
  root: string,
  options: PackDownloadOptions,
): Promise<string> {
  const { cache, target, version, sha256 } = await packLocation(root);
  const complete = path.join(target, ".verified");
  const isReady = async () =>
    (await readFile(complete, "utf8").catch(() => "")) === sha256;
  if (await isReady()) return target;

  await mkdir(cache, { recursive: true });
  const archive = await fetchPack(
    `https://github.com/mohitkale/reel-studio/releases/download/v${version}/reel-kokoro-voice-pack.json.gz`,
    options,
  );
  const files = unpackVoicePack(archive, sha256);
  const stage = await mkdtemp(path.join(cache, ".kokoro-"));
  try {
    for (const [key, body] of Object.entries(files)) {
      const file = path.join(stage, key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, Buffer.from(body, "base64"), { flag: "wx" });
    }
    await writeFile(path.join(stage, ".verified"), sha256);
    try {
      await rename(stage, target);
    } catch (error) {
      if (!(await isReady())) throw error;
    }
    return target;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}

export function ensureInstalledVoicePack(
  options: PackDownloadOptions = {},
): Promise<string> {
  const root = installed();
  if (!root)
    throw new Error(
      "Run the installed Reel Studio package to use a voice pack",
    );
  installing ??= installPack(root, options).catch((error) => {
    installing = undefined;
    throw error;
  });
  return installing;
}
