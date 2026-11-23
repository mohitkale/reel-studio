import { mediaDirectory } from "@/library/storage/media-directory";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { getAssetStore } from "@/library/storage";
import { sanitizeKey } from "@/library/storage/local-disk";
import { extractVideoFrame } from "@/library/video-frame";
import { assertPathInsideRoot } from "@/server/url-safety";

export function renderPosterKey(outputKey: string): string {
  return `${outputKey}.poster.jpg`;
}

const pending = new Map<string, Promise<Buffer | undefined>>();

async function saveRenderPoster(
  outputKey: string,
): Promise<Buffer | undefined> {
  const store = getAssetStore();
  const posterKey = renderPosterKey(outputKey);
  const cached = await store.get(posterKey).catch(() => undefined);
  if (cached?.length) return cached;

  const root = await fs.realpath(mediaDirectory());
  const candidate = assertPathInsideRoot(
    root,
    path.join(root, sanitizeKey(outputKey)),
  );
  const source = assertPathInsideRoot(root, await fs.realpath(candidate));
  if (!(await fs.stat(source)).isFile()) return undefined;

  const scale =
    "scale=480:480:force_original_aspect_ratio=decrease:force_divisible_by=2";
  const frame =
    (await extractVideoFrame(source, 1, scale)) ??
    (await extractVideoFrame(source, 0, scale));
  if (!frame) return undefined;

  // Publish the complete JPEG at once, including when web and worker both request it.
  const directory = assertPathInsideRoot(
    root,
    await fs.realpath(path.dirname(candidate)),
  );
  const poster = path.join(directory, path.basename(posterKey));
  const temporary = `${poster}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, frame, { flag: "wx" });
    await fs.rename(temporary, poster);
  } catch {
    // The freshly extracted frame is still suitable for this response.
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
  return frame;
}

/** Reuse the cached frame or generate one for a render made by an older install. */
export function ensureRenderPoster(
  outputKey: string,
): Promise<Buffer | undefined> {
  const existing = pending.get(outputKey);
  if (existing) return existing;
  const frame = saveRenderPoster(outputKey)
    .catch(() => undefined)
    .finally(() => {
      pending.delete(outputKey);
    });
  pending.set(outputKey, frame);
  return frame;
}
