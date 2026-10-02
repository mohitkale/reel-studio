import { assertRenderStagingAllowed } from "@/lib/render-media-policy";
import { downloadPublicMediaToFile } from "@/server/public-media-download";
import { productionSignal } from "@/library/production-cancellation";
import { parseSfxState } from "@/lib/sfx-cues";
import { getSfxClip, SFX_LIBRARY } from "@/lib/sfx-library";
import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { assertSafeMediaUrl } from "@/lib/media-url-safety";
import { sanitizeKey } from "@/library/storage/local-disk";
import { hashRenderFile } from "@/library/render-section-cache";
import { assertProductionActive } from "@/library/production-cancellation";
import type { VideoSnapshot } from "@/production/video-snapshot";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
export const videoStageHash = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");

/** Freeze local and DNS-checked remote assets into immutable checksum-addressed files. */
export async function resolveVideoStageMedia(
  snapshot: VideoSnapshot,
  baseUrl: string,
  dependencies: { download?: typeof downloadPublicMediaToFile } = {},
) {
  const result = structuredClone(snapshot);
  const assets: Array<{
    url: string;
    resolvedUrl: string;
    checksum: string | null;
  }> = [];
  const resolve = async (url: string | null): Promise<string | null> => {
    if (!url) return null;
    assertProductionActive();
    if (!SFX_LIBRARY.some((clip) => clip.url === url)) assertSafeMediaUrl(url);
    const parsed = new URL(url, baseUrl);
    const local =
      !url.startsWith("http") || parsed.origin === new URL(baseUrl).origin;
    if (!local) {
      assertRenderStagingAllowed(url);
      const directory = path.join(process.cwd(), "media", "production-assets");
      await fs.mkdir(directory, { recursive: true });
      const temporary = path.join(directory, `${randomUUID()}.tmp`);
      try {
        const media = await (
          dependencies.download ?? downloadPublicMediaToFile
        )(url, temporary, { signal: productionSignal() });
        const checksum = await hashRenderFile(temporary);
        const target = `production-assets/${checksum}.${media.extension}`;
        const destination = path.join(process.cwd(), "media", target);
        assertProductionActive();
        const cached = await hashRenderFile(destination).catch((error) => {
          if (error.code === "ENOENT") return null;
          throw error;
        });
        if (cached !== checksum) await fs.rename(temporary, destination);
        const resolvedUrl = `/media/${target}`;
        assets.push({ url, resolvedUrl, checksum });
        return resolvedUrl;
      } finally {
        await fs.rm(temporary, { force: true });
      }
    }
    const pathname = decodeURIComponent(parsed.pathname);
    const media = pathname.startsWith("/media/");
    const key = sanitizeKey(pathname.slice(media ? 7 : 1));
    const root = path.resolve(process.cwd(), media ? "media" : "public");
    const source = path.join(root, key);
    const real = await fs.realpath(source);
    const realRoot = await fs.realpath(root);
    if (!real.startsWith(realRoot + path.sep))
      throw new Error("Media resolves outside its store");
    const directory = path.join(process.cwd(), "media", "production-assets");
    await fs.mkdir(directory, { recursive: true });
    const temporary = path.join(directory, `${randomUUID()}.tmp`);
    let target: string;
    let checksum: string;
    try {
      // Hash the copied snapshot, not a source that can change between hash/copy.
      await fs.copyFile(real, temporary, fs.constants.COPYFILE_EXCL);
      assertProductionActive();
      checksum = await hashRenderFile(temporary);
      target = `production-assets/${checksum}${path.extname(key)}`;
      const destination = path.join(process.cwd(), "media", target);
      const cached = await hashRenderFile(destination).catch(
        (error: unknown) => {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
          throw error;
        },
      );
      assertProductionActive();
      if (cached !== checksum) await fs.rename(temporary, destination);
    } finally {
      await fs.rm(temporary, { force: true });
    }
    const resolvedUrl = `/media/${target}`;
    assets.push({ url, resolvedUrl, checksum });
    return resolvedUrl;
  };
  for (const scene of result.script.scenes) {
    if (scene.background)
      scene.background.url = (await resolve(scene.background.url))!;
    if (scene.carouselImages)
      scene.carouselImages = await Promise.all(
        scene.carouselImages.map(async (url) => (await resolve(url))!),
      );
  }
  result.script.coverUrl = await resolve(result.script.coverUrl);
  result.script.musicUrl = await resolve(result.script.musicUrl);
  if (result.take)
    result.take.audioUrl = (await resolve(result.take.audioUrl))!;
  result.sfxAssets = {};
  if (result.script.sfxEnabled)
    for (const cue of parseSfxState(result.script.sfxJson).cues) {
      const clip = getSfxClip(cue.sfxId);
      if (clip) result.sfxAssets[clip.url] = (await resolve(clip.url))!;
    }
  return { snapshot: result, assets };
}
