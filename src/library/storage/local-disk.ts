import { promises as fs, constants } from "node:fs";
import path from "node:path";

import { assertPathInsideRoot } from "@/server/url-safety";
import { type AssetStore, type StoredAsset, type ReadableAsset } from "./types";

/** Reject keys that could escape the media root via traversal or absolute paths. */
export function sanitizeKey(key: string): string {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    normalized.includes("..") ||
    normalized.includes("\0") ||
    path.isAbsolute(normalized)
  ) {
    throw new Error(`Invalid asset key: ${key}`);
  }
  return normalized;
}

/** Filesystem-backed AssetStore rooted at the local media/ directory. */
export class LocalDiskStore implements AssetStore {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    const clean = sanitizeKey(key);
    return assertPathInsideRoot(this.root, path.join(this.root, clean));
  }

  async put(key: string, data: Buffer): Promise<StoredAsset> {
    const clean = sanitizeKey(key);
    const full = this.resolve(clean);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return { key: clean };
  }

  async get(key: string): Promise<Buffer> {
    const asset = await this.open(key);
    return Buffer.from(await new Response(asset.stream()).arrayBuffer());
  }

  async open(key: string): Promise<ReadableAsset> {
    const filename = this.resolve(key);
    const root = await fs.realpath(this.root);
    const real = assertPathInsideRoot(root, await fs.realpath(filename));
    if (!(await fs.stat(real)).isFile())
      throw new Error("Asset must be a regular file");
    const handle = await fs.open(
      real,
      constants.O_RDONLY |
        (constants.O_NOFOLLOW ?? 0) |
        (constants.O_NONBLOCK ?? 0),
    );
    let closing: Promise<void> | undefined;
    const close = () => (closing ??= handle.close());
    let size: number;
    try {
      const stat = await handle.stat();
      if (!stat.isFile()) throw new Error("Asset must be a regular file");
      size = stat.size;
    } catch (error) {
      await close();
      throw error;
    }
    let used = false;
    return {
      size,
      close,
      stream({ start = 0, end = size - 1, signal } = {}) {
        if (used || closing) throw new Error("Asset read already consumed");
        if (
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) ||
          start < 0 ||
          end >= size ||
          (end < start && size !== 0)
        )
          throw new Error("Invalid asset range");
        used = true;
        let position = start;
        let finished = false;
        let abort: () => void;
        const finish = async () => {
          finished = true;
          signal?.removeEventListener("abort", abort);
          await close();
        };
        return new ReadableStream<Uint8Array>(
          {
            start(controller) {
              abort = () => {
                if (finished) return;
                controller.error(
                  signal?.reason ?? new Error("Asset read aborted"),
                );
                void finish().catch(() => {});
              };
              signal?.addEventListener("abort", abort, { once: true });
              if (signal?.aborted) abort();
            },
            async pull(controller) {
              if (finished) return;
              try {
                if (position > end) {
                  await finish();
                  controller.close();
                  return;
                }
                const bytes = new Uint8Array(
                  Math.min(64 * 1024, end - position + 1),
                );
                const { bytesRead } = await handle.read(
                  bytes,
                  0,
                  bytes.length,
                  position,
                );
                if (finished) return;
                if (bytesRead === 0)
                  throw new Error("Asset truncated during read");
                position += bytesRead;
                controller.enqueue(bytes.subarray(0, bytesRead));
                if (position > end) {
                  await finish();
                  controller.close();
                }
              } catch (error) {
                if (finished) return;
                controller.error(error);
                await finish();
              }
            },
            cancel: finish,
          },
          { highWaterMark: 0 },
        );
      },
    };
  }

  url(key: string): string {
    return `/media/${sanitizeKey(key)}`;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolve(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
}
