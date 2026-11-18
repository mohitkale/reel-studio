import { prisma } from "@/library/db";
import { createAsset } from "@/library/repositories/assets";
import { getAssetStore } from "@/library/storage";
import type { Orientation } from "@/lib/orientation";
import {
  imageCacheKey,
  imageSeed,
  imageSize,
  imageStyleForTheme,
} from "@/providers/image/style";
import type { ImageProvider } from "@/providers/image/types";

export interface GeneratedSceneImages {
  /** Library asset id per scene, where a picture was made or found in the cache. */
  assetIds: Array<string | undefined>;
  /** Plain notes for scenes that fell back, for the result's warnings. */
  notes: string[];
  generated: number;
  cached: number;
}

const EXTENSION = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;

/**
 * Make the pictures a storyboard asked for with `media.generate`. With no
 * provider, or when a picture fails, the scene keeps its stock search or themed
 * background and the note says so: a missing image model is never an error.
 * Pictures are cached by prompt, style, seed, size and model, and each is a
 * library asset, so a repeat render makes nothing new.
 */
export async function generateSceneImages(input: {
  prompts: Array<string | undefined>;
  orientation: Orientation;
  themeId?: string;
  videoSeed: string;
  provider: ImageProvider | null;
  signal?: AbortSignal;
}): Promise<GeneratedSceneImages> {
  const result: GeneratedSceneImages = {
    assetIds: input.prompts.map(() => undefined),
    notes: [],
    generated: 0,
    cached: 0,
  };
  const wanted = input.prompts.flatMap((prompt, index) =>
    prompt ? [{ prompt, index }] : [],
  );
  if (wanted.length === 0) return result;
  if (!input.provider) {
    for (const { index } of wanted)
      result.notes.push(
        `scenes.${index}: no image generator is set up, so a stock picture or the themed background is used (Settings, Image generation)`,
      );
    return result;
  }
  const provider = input.provider;
  const style = imageStyleForTheme(input.themeId);
  const { width, height } = imageSize(input.orientation);
  for (const { prompt, index } of wanted) {
    const seed = imageSeed(input.videoSeed, index);
    const key = imageCacheKey({
      providerId: provider.id,
      model: provider.model,
      prompt,
      style,
      seed,
      width,
      height,
    });
    const storePrefix = `assets/generated/${key}`;
    const existing = await prisma.asset.findFirst({
      where: { path: { startsWith: storePrefix } },
    });
    if (existing) {
      result.assetIds[index] = existing.id;
      result.cached++;
      continue;
    }
    try {
      const image = await provider.generate({
        prompt,
        style,
        seed,
        width,
        height,
        signal: input.signal,
      });
      const storeKey = `${storePrefix}.${EXTENSION[image.mime]}`;
      await getAssetStore().put(storeKey, image.bytes);
      const asset = await createAsset(
        "image",
        storeKey,
        `Generated: ${prompt.slice(0, 60)}`,
        {
          generated: true,
          prompt,
          style,
          seed,
          provider: provider.id,
          model: provider.model,
        },
      );
      result.assetIds[index] = asset.id;
      result.generated++;
    } catch (error) {
      if (input.signal?.aborted) throw error;
      result.notes.push(
        `scenes.${index}: the image could not be made (${error instanceof Error ? error.message : String(error)}), so a stock picture or the themed background is used`,
      );
    }
  }
  return result;
}
