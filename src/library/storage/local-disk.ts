import { promises as fs } from "node:fs";
import path from "node:path";

import { type AssetStore, type StoredAsset } from "./types";

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
    return path.join(this.root, sanitizeKey(key));
  }

  async put(key: string, data: Buffer): Promise<StoredAsset> {
    const clean = sanitizeKey(key);
    const full = path.join(this.root, clean);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return { key: clean };
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
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
