import { mediaDirectory } from "@/library/storage/media-directory";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { prisma } from "@/library/db";
import { getAssetStore } from "@/library/storage";

const run = promisify(execFile);

export interface BrandSting {
  url: string;
  durationSeconds: number;
}

export interface BrandStings {
  intro?: BrandSting;
  outro?: BrandSting;
}

async function probeSeconds(file: string): Promise<number | undefined> {
  try {
    const { stdout } = await run("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      file,
    ]);
    const seconds = Number(stdout.trim());
    return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
  } catch {
    return undefined;
  }
}

async function stingFor(
  assetId: string | null,
): Promise<BrandSting | undefined> {
  if (!assetId) return undefined;
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset || asset.type !== "audio") return undefined;
  const seconds = await probeSeconds(path.join(mediaDirectory(), asset.path));
  // A sting is a moment, not a track: anything over thirty seconds is not one.
  if (!seconds || seconds > 30) return undefined;
  return {
    url: getAssetStore().url(asset.path),
    durationSeconds: Math.round(seconds * 100) / 100,
  };
}

/**
 * The start and end stings of the brand kit a script's project wears, when the
 * kit names uploaded audio for them. A missing, removed or non-audio asset, or
 * one longer than thirty seconds, is ignored.
 */
export async function resolveBrandStings(
  scriptId: string,
): Promise<BrandStings> {
  const script = await prisma.script.findUnique({
    where: { id: scriptId },
    select: { project: { select: { brandKitId: true } } },
  });
  const kitId = script?.project.brandKitId;
  if (!kitId) return {};
  const kit = await prisma.brandKit.findUnique({ where: { id: kitId } });
  if (!kit) return {};
  const [intro, outro] = await Promise.all([
    stingFor(kit.introStingAssetId),
    stingFor(kit.outroStingAssetId),
  ]);
  return { ...(intro ? { intro } : {}), ...(outro ? { outro } : {}) };
}
