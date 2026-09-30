import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { renderMedia, type RenderMediaOptions } from "@remotion/renderer";
import type { VideoConfig } from "remotion";
import type { ReelProps } from "@/compositions/types";
import { planRenderSections } from "@/production/render-sections";
import { sectionVisualProps } from "@/production/section-visuals";
import { assertPathInsideRoot } from "@/server/url-safety";
import {
  cancelableRemotion,
  assertProductionActive,
} from "@/library/production-cancellation";
import {
  assembleRenderSections,
  hashRenderDirectory,
  hashRenderFile,
  renderCachedSection,
  renderCacheKey,
} from "@/library/render-section-cache";

const bundleHashes = new Map<string, Promise<string>>();
function mediaUrls(props: ReelProps) {
  return [
    ...new Set(
      [
        props.audioUrl,
        props.musicUrl,
        props.coverUrl,
        ...(props.sfxCues ?? []).map((cue) => cue.url),
        ...props.scenes.flatMap((scene) => [
          scene.background?.url,
          ...(scene.carouselImages ?? []),
        ]),
      ].filter((url): url is string => Boolean(url)),
    ),
  ].sort();
}
export function canCacheRemotionSections(
  props: ReelProps,
  serverBaseUrl: string,
) {
  return mediaUrls(props).every((url) => {
    try {
      const parsed = new URL(url, serverBaseUrl);
      return (
        parsed.origin === new URL(serverBaseUrl).origin &&
        ["/media/", "/music/", "/sfx/"].some((prefix) =>
          parsed.pathname.startsWith(prefix),
        )
      );
    } catch {
      return false;
    }
  });
}
async function mediaHashes(props: ReelProps, serverBaseUrl: string) {
  const urls = mediaUrls(props);
  return Promise.all(
    urls.map(async (url) => {
      const parsed = new URL(url, serverBaseUrl);
      if (parsed.origin !== new URL(serverBaseUrl).origin)
        throw new Error(
          "Section rendering requires frozen local media. Use Produce reel to freeze remote assets.",
        );
      const pathname = decodeURIComponent(parsed.pathname);
      const root = pathname.startsWith("/media/")
        ? path.join(process.cwd(), "media")
        : pathname.startsWith("/music/")
          ? path.join(process.cwd(), "public", "music")
          : pathname.startsWith("/sfx/")
            ? path.join(process.cwd(), "public", "sfx")
            : undefined;
      if (!root)
        throw new Error(
          "Section rendering received an unsupported local media path.",
        );
      const filename = assertPathInsideRoot(
        root,
        path.join(root, pathname.slice(pathname.indexOf("/", 1) + 1)),
      );
      const real = assertPathInsideRoot(
        await fs.realpath(root),
        await fs.realpath(filename),
      );
      return [parsed.pathname + parsed.search, await hashRenderFile(real)] as const;
    }),
  );
}

/** Render bounded global ranges; export the complete audio graph once as PCM. */
export async function renderRemotionSections(args: {
  serveUrl: string;
  composition: VideoConfig;
  inputProps: ReelProps;
  outputPath: string;
  settings: Pick<
    RenderMediaOptions,
    "scale" | "x264Preset" | "crf" | "concurrency" | "offthreadVideoThreads"
  >;
  chapterStarts?: number[];
  serverBaseUrl: string;
  onProgress: (progress: number) => void;
}) {
  const { composition, inputProps } = args;
  const localUrl = (url: string | undefined) => {
    if (!url) return url;
    const parsed = new URL(url, args.serverBaseUrl);
    return parsed.origin === new URL(args.serverBaseUrl).origin
      ? parsed.pathname + parsed.search
      : url;
  };
  const canonicalProps = (props: ReelProps) => ({
    ...props,
    audioUrl: localUrl(props.audioUrl),
    musicUrl: localUrl(props.musicUrl),
    coverUrl: localUrl(props.coverUrl),
    sfxCues: props.sfxCues?.map((cue) => ({
      ...cue,
      url: localUrl(cue.url),
    })),
    scenes: props.scenes.map((scene) => ({
      ...scene,
      background: scene.background
        ? { ...scene.background, url: localUrl(scene.background.url) }
        : undefined,
      carouselImages: scene.carouselImages?.map(localUrl),
    })),
  });
  const sections = planRenderSections(
    composition.durationInFrames,
    composition.fps,
    args.chapterStarts,
  );
  let bundleHash = bundleHashes.get(args.serveUrl);
  if (!bundleHash) {
    bundleHash = hashRenderDirectory(args.serveUrl);
    bundleHashes.set(args.serveUrl, bundleHash);
  }
  const renderer = JSON.parse(
    await fs.readFile(
      path.join(process.cwd(), "node_modules/@remotion/renderer/package.json"),
      "utf8",
    ),
  ) as { version: string };
  const identity = {
    version: 2,
    engine: "remotion",
    renderer: renderer.version,
    node: process.version,
    bundle: await bundleHash,
    composition: {
      id: composition.id,
      width: composition.width,
      height: composition.height,
      fps: composition.fps,
      durationInFrames: composition.durationInFrames,
    },
    settings: args.settings,
  };
  const media = new Map(await mediaHashes(inputProps, args.serverBaseUrl));
  const common = {
    serveUrl: args.serveUrl,
    composition,
    inputProps,
    logLevel: "error" as const,
    timeoutInMilliseconds: 300_000,
    mediaCacheSizeInBytes: 256 * 1024 * 1024,
    offthreadVideoCacheSizeInBytes: 256 * 1024 * 1024,
  };
  const paths: string[] = [];
  for (const section of sections) {
    const scoped = sectionVisualProps(inputProps, section, composition.fps);
    const key = renderCacheKey({
      ...identity,
      inputProps: canonicalProps(scoped),
      media: mediaUrls(scoped).map((url) => {
        const local = localUrl(url)!;
        const fingerprint = media.get(local);
        if (!fingerprint)
          throw new Error(
            "A section visual is missing its frozen media fingerprint.",
          );
        return [local, fingerprint];
      }),
    });
    const result = await renderCachedSection({
      key,
      section,
      render: (outputLocation) =>
        cancelableRemotion((cancelSignal) =>
          renderMedia({
            ...common,
            inputProps: scoped,
            ...args.settings,
            cancelSignal,
            outputLocation,
            codec: "h264",
            muted: true,
            hardwareAcceleration: "disable",
            imageFormat: "jpeg",
            pixelFormat: "yuv420p",
            gopSize: section.endFrame - section.startFrame + 1,
            frameRange: [section.startFrame, section.endFrame],
            onProgress: ({ progress }) =>
              args.onProgress(
                (0.85 *
                  (section.startFrame +
                    progress * (section.endFrame - section.startFrame + 1))) /
                  composition.durationInFrames,
              ),
          }),
        ).then(() => undefined),
    });
    paths.push(result.filename);
    console.log(
      `[render:sections] ${JSON.stringify({ engine: "remotion", index: section.index, reused: result.reused })}`,
    );
    args.onProgress(
      (0.85 * (section.endFrame + 1)) / composition.durationInFrames,
    );
  }
  const audioPath = `${args.outputPath}.${randomUUID()}.mix.wav`;
  const hasAudio = Boolean(
    inputProps.audioUrl || inputProps.musicUrl || inputProps.sfxCues?.length,
  );
  try {
    if (hasAudio)
      await cancelableRemotion((cancelSignal) =>
        renderMedia({
          ...common,
          cancelSignal,
          codec: "wav",
          audioCodec: "pcm-16",
          sampleRate: 48_000,
          enforceAudioTrack: true,
          outputLocation: audioPath,
          concurrency: 2,
          onProgress: ({ progress }) => args.onProgress(0.85 + progress * 0.05),
        }),
      );
    assertProductionActive();
    await assembleRenderSections(
      paths,
      hasAudio ? audioPath : undefined,
      args.outputPath,
      composition.durationInFrames,
      composition.fps,
    );
    args.onProgress(0.95);
  } finally {
    await fs.rm(audioPath, { force: true });
  }
}
