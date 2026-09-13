import { parseSfxState } from "@/lib/sfx-cues";
import { getSfxClip } from "@/lib/sfx-library";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { assertSafeMediaUrl } from "@/lib/media-url-safety";
import { sanitizeKey } from "@/library/storage/local-disk";
import { assertProductionActive } from "@/library/production-cancellation";
import type { VideoSnapshot } from "@/production/video-snapshot";

export const videoStageHash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** Freeze selected local assets, retaining compliant remote URLs without downloading. */
export async function resolveVideoStageMedia(
  snapshot: VideoSnapshot,
  baseUrl: string,
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
    if (!url.startsWith("/sfx/")) assertSafeMediaUrl(url);
    const parsed = new URL(url, baseUrl);
    const local =
      !url.startsWith("http") || parsed.origin === new URL(baseUrl).origin;
    if (!local) {
      assets.push({ url, resolvedUrl: url, checksum: null });
      return url;
    }
    const pathname = decodeURIComponent(parsed.pathname);
    const media = pathname.startsWith("/media/");
    const key = sanitizeKey(pathname.slice(media ? 7 : 1));
    const root = path.resolve(process.cwd(), media ? "media" : "public");
    const source = path.join(root, key);
    const real = await fs.realpath(source);
    if (!real.startsWith(root + path.sep))
      throw new Error("Media resolves outside its store");
    const data = await fs.readFile(real);
    const checksum = createHash("sha256").update(data).digest("hex");
    const target = `production-assets/${checksum}${path.extname(key)}`;
    await fs.mkdir(path.join(process.cwd(), "media", "production-assets"), {
      recursive: true,
    });
    await fs
      .writeFile(path.join(process.cwd(), "media", target), data, {
        flag: "wx",
      })
      .catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "EEXIST") throw error;
      });
    const resolvedUrl = `/media/${target}`;
    assets.push({ url, resolvedUrl, checksum });
    return resolvedUrl;
  };
  for (const scene of result.script.scenes)
    if (scene.background)
      scene.background.url = (await resolve(scene.background.url))!;
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
