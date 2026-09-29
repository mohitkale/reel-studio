/** Real, credential-free renders for both engines. Outputs stay in .artifacts. */
import { copyFile, mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { bundle } from "@remotion/bundler";
import {
  renderMedia,
  renderStill,
  selectComposition,
} from "@remotion/renderer";
import fixture from "../tests/fixtures/legacy-reel.json";
import productLaunchFixture from "../tests/fixtures/product-launch-reel.json";
import editorialExplainerFixture from "../tests/fixtures/editorial-explainer-reel.json";
import creatorPunchFixture from "../tests/fixtures/creator-punch-reel.json";
import dataStoryFixture from "../tests/fixtures/data-story-reel.json";
import developerDemoFixture from "../tests/fixtures/developer-demo-reel.json";
import cinematicBrandFixture from "../tests/fixtures/cinematic-brand-reel.json";
import type { ReelProps } from "../src/compositions/types";
import { TEMPLATES } from "../src/compositions/templates";
import { buildHyperframesCompositionHtml } from "../src/engines/hyperframes/build-composition";
import { remotionWebpackOverride } from "../src/remotion/webpack-override";
import { HYPERFRAMES_RENDER_FONT_FILES } from "../src/engines/hyperframes/render-fonts";
import releaseBriefs from "../tests/fixtures/release-briefs.json";
import { applyReleaseBriefToFixture } from "./release-brief-fixture";
import {
  ORIENTATIONS,
  dimsFor,
  type Orientation,
} from "../src/lib/orientation";
import { CURRENT_HF_CATALOG_REVISION } from "../src/engines/hyperframes/catalog/revisions";
import {
  isDataMotionRecipe,
  isDiagramMotionRecipe,
  isMediaMotionRecipe,
  motionDirection,
  motionRecipeIdSchema,
} from "../src/production/motion";

import { buildAutomaticSfxCues } from "../src/lib/sfx-planner";
import { parseWav } from "../src/lib/wav";
import { getSfxClip } from "../src/lib/sfx-library";
import { resolveReelSfxCues } from "../src/lib/sfx-cues";
import type { VideoEngineId } from "../src/engines/types";
import type { SceneDTO } from "../src/lib/dto";

async function main() {
  const run = promisify(execFile);
  const args = process.argv.slice(2);
  const presetArg = args.find((arg) => arg.startsWith("--preset="));
  const orientationArg = args.find((arg) => arg.startsWith("--orientation="));
  const briefIndexArg = args.find((arg) => arg.startsWith("--brief-index="));
  const renderStockVideo = args.includes("--stock-video");
  const renderCarousel = args.includes("--carousel");
  const renderMotionSound = args.includes("--motion-sfx");
  const motionArg = args.find((arg) => arg.startsWith("--motion-recipe="));
  const motionRecipeId = motionArg
    ? motionRecipeIdSchema.parse(motionArg.slice("--motion-recipe=".length))
    : undefined;
  if (renderMotionSound && !motionRecipeId)
    throw new Error("--motion-sfx requires --motion-recipe");
  const briefIndex = briefIndexArg
    ? Number(briefIndexArg.slice("--brief-index=".length))
    : undefined;
  const orientation = orientationArg?.slice("--orientation=".length);
  if (orientation && !ORIENTATIONS.includes(orientation as Orientation)) {
    throw new Error(`Unknown orientation: ${orientation}`);
  }
  const presetId = args.includes("--product-launch")
    ? "product-launch"
    : presetArg?.slice("--preset=".length);
  if ((renderStockVideo || renderCarousel) && presetId) {
    throw new Error(
      "Stock-video and carousel regressions cannot be combined with a preset",
    );
  }
  const presetFixtures: Record<string, unknown> = {
    "product-launch": productLaunchFixture,
    "editorial-explainer": editorialExplainerFixture,
    "creator-punch": creatorPunchFixture,
    "data-story": dataStoryFixture,
    "developer-demo": developerDemoFixture,
    "cinematic-brand": cinematicBrandFixture,
  };
  if (presetId && !presetFixtures[presetId]) {
    throw new Error(`Unknown render fixture preset: ${presetId}`);
  }
  if (
    briefIndex !== undefined &&
    (!Number.isInteger(briefIndex) || briefIndex < 0 || briefIndex > 2)
  ) {
    throw new Error(`Invalid release brief index: ${briefIndexArg}`);
  }
  if (briefIndex !== undefined && !presetId) {
    throw new Error("Release brief renders require --preset");
  }
  const renderPreset = Boolean(presetId || motionRecipeId);
  const renderProductLaunch = presetId === "product-launch";
  const renderDeveloperDemo = presetId === "developer-demo";
  const renderCinematicBrand = presetId === "cinematic-brand";
  const output = orientation
    ? path.resolve(
        ".artifacts/render-regression",
        renderStockVideo
          ? motionRecipeId
            ? `${motionRecipeId}-video`
            : "stock-video"
          : renderCarousel
            ? "carousel"
            : renderMotionSound
              ? `${motionRecipeId}-sound`
              : (motionRecipeId ?? presetId ?? "legacy"),
        ...(briefIndex === undefined ? [] : [`brief-${briefIndex + 1}`]),
        orientation,
      )
    : path.resolve(
        ".artifacts/render-regression",
        renderStockVideo
          ? motionRecipeId
            ? `${motionRecipeId}-video`
            : "stock-video"
          : renderCarousel
            ? "carousel"
            : renderMotionSound
              ? `${motionRecipeId}-sound`
              : (motionRecipeId ?? presetId ?? "legacy"),
      );
  await mkdir(output, { recursive: true });
  const stockVideoSource = path.join(output, "stock-video-source.mp4");
  if (renderStockVideo) {
    await run("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=640x360:rate=30",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:sample_rate=48000",
      "-t",
      motionRecipeId ? "1.75" : "4",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-shortest",
      "-y",
      stockVideoSource,
    ]);
    const sourceProbe = JSON.parse(
      (
        await run("ffprobe", [
          "-v",
          "error",
          "-show_entries",
          "stream=codec_type",
          "-of",
          "json",
          stockVideoSource,
        ])
      ).stdout,
    );
    if (
      !sourceProbe.streams?.some(
        (stream: { codec_type?: string }) => stream.codec_type === "audio",
      )
    ) {
      throw new Error("Stock-video fixture must contain an audio track");
    }
  }
  const engines = args.filter((arg) => !arg.startsWith("--"));
  const selected = engines.length ? engines : ["hyperframes", "remotion"];
  if (
    selected.some((engine) => !["hyperframes", "remotion"].includes(engine))
  ) {
    throw new Error("Expected hyperframes and/or remotion");
  }
  const productAssetDataUrl = renderProductLaunch
    ? `data:image/svg+xml;base64,${(
        await readFile(
          path.resolve("public/samples/product-launch-dashboard.svg"),
        )
      ).toString("base64")}`
    : undefined;
  const developerAssetDataUrl = renderDeveloperDemo
    ? `data:image/svg+xml;base64,${(
        await readFile(
          path.resolve("public/samples/developer-demo-browser.svg"),
        )
      ).toString("base64")}`
    : undefined;
  const cinematicAssetDataUrl = renderCinematicBrand
    ? `data:image/svg+xml;base64,${(
        await readFile(path.resolve("public/samples/cinematic-brand-hero.svg"))
      ).toString("base64")}`
    : undefined;
  const mediaMotionAssetDataUrl = isMediaMotionRecipe(
    motionRecipeId ?? "type-impact",
  )
    ? `data:image/svg+xml;base64,${(
        await readFile(
          path.resolve(
            motionRecipeId === "media-device"
              ? "public/samples/product-launch-dashboard.svg"
              : "public/samples/cinematic-brand-hero.svg",
          ),
        )
      ).toString("base64")}`
    : undefined;
  const carouselImages = renderCarousel
    ? await Promise.all(
        [
          "public/samples/product-launch-dashboard.svg",
          "public/samples/developer-demo-browser.svg",
          "public/samples/cinematic-brand-hero.svg",
        ].map(
          async (filename) =>
            `data:image/svg+xml;base64,${(await readFile(path.resolve(filename))).toString("base64")}`,
        ),
      )
    : undefined;
  const selectedFixture = motionRecipeId
    ? {
        ...(fixture as ReelProps),
        scenes: [
          {
            id: "motion-regression",
            templateId: "hf-opener",
            role: isDataMotionRecipe(motionRecipeId)
              ? motionRecipeId === "data-bars"
                ? "chart"
                : "metric"
              : isDiagramMotionRecipe(motionRecipeId)
                ? "diagram"
                : isMediaMotionRecipe(motionRecipeId)
                  ? motionRecipeId === "media-device"
                    ? "screenshot-demo"
                    : "hero"
                  : "hook",
            motion: motionDirection(motionRecipeId),
            text: isDataMotionRecipe(motionRecipeId)
              ? "Completion across groups"
              : isDiagramMotionRecipe(motionRecipeId)
                ? "From idea to release"
                : isMediaMotionRecipe(motionRecipeId)
                  ? motionRecipeId === "media-device"
                    ? "A clearer creative workspace"
                    : "Every frame tells the story"
                  : "Make every moment matter.",
            emphasis:
              isDataMotionRecipe(motionRecipeId) ||
              isDiagramMotionRecipe(motionRecipeId) ||
              isMediaMotionRecipe(motionRecipeId)
                ? []
                : ["matter"],
            items: isDiagramMotionRecipe(motionRecipeId)
              ? motionRecipeId === "diagram-orbit"
                ? ["Creative system", "Story", "Motion", "Sound", "Review"]
                : [
                    "Find the idea",
                    "Shape the story",
                    "Build the visuals",
                    "Review the cut",
                  ]
              : undefined,
            background: mediaMotionAssetDataUrl
              ? { type: "image" as const, url: mediaMotionAssetDataUrl }
              : undefined,
            chart: isDataMotionRecipe(motionRecipeId)
              ? {
                  labels:
                    motionRecipeId === "data-bars"
                      ? ["Before", "After", "Control", "Pilot"]
                      : ["Completion"],
                  series: [
                    {
                      label: "Creator survey",
                      values:
                        motionRecipeId === "data-bars"
                          ? [32, 72, 48, 61]
                          : [72],
                      unit: "%",
                    },
                  ],
                  sourceAttribution: "Reel Studio example data",
                }
              : undefined,
            order: 0,
          },
        ],
        timeline: [
          { sceneId: "motion-regression", startFrame: 0, durationFrames: 90 },
        ],
        preset: { id: "creator-punch" as const, version: "1.0.0" },
        audioUrl: undefined,
        musicUrl: undefined,
        sfxCues: [],
      }
    : renderCarousel
      ? {
          ...(fixture as ReelProps),
          scenes: [
            {
              id: "carousel-circle-regression",
              templateId: "hf-carousel-circle-v1",
              text: "Supplied images orbit in a responsive circle.",
              emphasis: ["responsive circle"],
              carouselImages,
              mood: "tech",
            },
            {
              id: "carousel-path-regression",
              templateId: "hf-carousel-path-v1",
              text: "A local image path stays deterministic.",
              emphasis: ["deterministic"],
              carouselImages,
              mood: "tech",
            },
            {
              id: "carousel-vision-regression",
              templateId: "hf-carousel-vision-v1",
              text: "Project media becomes a cinematic gallery.",
              emphasis: ["cinematic gallery"],
              carouselImages,
              mood: "tech",
            },
          ],
          timeline: [
            {
              sceneId: "carousel-circle-regression",
              startFrame: 0,
              durationFrames: 60,
            },
            {
              sceneId: "carousel-path-regression",
              startFrame: 60,
              durationFrames: 60,
            },
            {
              sceneId: "carousel-vision-regression",
              startFrame: 120,
              durationFrames: 60,
            },
          ],
          audioUrl: undefined,
          musicUrl: undefined,
          sfxCues: [],
          catalogRevision: CURRENT_HF_CATALOG_REVISION,
        }
      : presetId
        ? presetFixtures[presetId]
        : fixture;
  const fixtureWithLocalAssets = (
    renderProductLaunch || renderDeveloperDemo || renderCinematicBrand
      ? {
          ...(selectedFixture as ReelProps),
          scenes: (selectedFixture as ReelProps).scenes.map((scene) => ({
            ...scene,
            background: scene.background
              ? {
                  ...scene.background,
                  url: renderProductLaunch
                    ? productAssetDataUrl!
                    : renderDeveloperDemo
                      ? developerAssetDataUrl!
                      : cinematicAssetDataUrl!,
                }
              : undefined,
          })),
        }
      : selectedFixture
  ) as ReelProps;
  const brief =
    presetId && briefIndex !== undefined
      ? (releaseBriefs as Record<string, string[]>)[presetId]?.[briefIndex]
      : undefined;
  if (briefIndex !== undefined && !brief) {
    throw new Error(`Missing release brief ${briefIndex + 1} for ${presetId}`);
  }
  const fixtureProps = brief
    ? applyReleaseBriefToFixture({
        fixture: fixtureWithLocalAssets,
        presetId: presetId as keyof typeof releaseBriefs,
        brief,
        briefIndex: briefIndex!,
      })
    : fixtureWithLocalAssets;
  const dimensions = orientation
    ? dimsFor(orientation as Orientation)
    : { width: fixtureProps.width, height: fixtureProps.height };
  const props: ReelProps = {
    ...fixtureProps,
    ...dimensions,
    ...(renderStockVideo
      ? {
          scenes: fixtureProps.scenes.map((scene, index) => ({
            ...scene,
            background:
              index === 0
                ? {
                    type: "video" as const,
                    url: "stock-video.mp4",
                    muted: false,
                    stock: true,
                  }
                : undefined,
          })),
          audioUrl: undefined,
          musicUrl: undefined,
          sfxCues: [],
        }
      : {}),
    captions:
      renderStockVideo || renderCarousel || motionRecipeId
        ? { enabled: false, timingSource: "imported", cues: [] }
        : (fixtureProps.captions ?? {
            enabled: true,
            timingSource: "imported",
            cues: [
              {
                id: "regression-caption",
                startFrame: 15,
                endFrame: 75,
                text: "Editable subtitles render separately from scene copy.",
              },
            ],
          }),
  };
  const expectedFrames = props.timeline.reduce(
    (max, beat) => Math.max(max, beat.startFrame + beat.durationFrames),
    1,
  );
  async function verifyForeground(mp4: string, engine: string) {
    const probe = JSON.parse(
      (
        await run("ffprobe", [
          "-v",
          "error",
          "-show_entries",
          "stream=codec_name,codec_type,width,height",
          "-show_entries",
          "format=duration",
          "-of",
          "json",
          mp4,
        ])
      ).stdout,
    );
    if (
      probe.streams?.find(
        (stream: { codec_type?: string }) => stream.codec_type === "video",
      )?.codec_name !== "h264" ||
      probe.streams.find(
        (stream: { codec_type?: string }) => stream.codec_type === "video",
      )?.width !== props.width ||
      probe.streams.find(
        (stream: { codec_type?: string }) => stream.codec_type === "video",
      )?.height !== props.height ||
      Number(probe.format?.duration) < expectedFrames / (props.fps ?? 30) - 0.2
    ) {
      throw new Error(`${engine}: unexpected output metadata`);
    }
    if (
      renderStockVideo &&
      probe.streams.some(
        (stream: { codec_type?: string }) => stream.codec_type === "audio",
      )
    ) {
      throw new Error(`${engine}: muted stock fixture leaked an audio track`);
    }
    if (renderMotionSound) {
      const planned = JSON.parse(
        await readFile(path.join(output, `${engine}-sfx.json`), "utf8"),
      ) as Array<{ url: string; startFrame: number }>;
      if (planned.length) {
        if (
          !probe.streams.some(
            (stream: { codec_type?: string }) => stream.codec_type === "audio",
          )
        )
          throw new Error(`${engine}: anchored sound is missing`);
        const audioPath = path.join(output, `${engine}-sound.wav`);
        await run("ffmpeg", [
          "-v",
          "error",
          "-i",
          mp4,
          "-vn",
          "-ac",
          "1",
          "-ar",
          "44100",
          "-c:a",
          "pcm_s16le",
          "-y",
          audioPath,
        ]);
        const wav = await readFile(audioPath);
        const info = parseWav(wav);
        const window = Math.round(info.sampleRate * 0.01);
        let maxEnergy = -1,
          peakTime = 0;
        for (let start = 0; start < info.dataLength / 2; start += window) {
          const length = Math.min(window, info.dataLength / 2 - start);
          let energy = 0;
          for (let i = 0; i < length; i++) {
            const value = wav.readInt16LE(info.dataOffset + (start + i) * 2);
            energy += value * value;
          }
          if (energy / length > maxEnergy) {
            maxEnergy = energy / length;
            peakTime = (start + length / 2) / info.sampleRate;
          }
        }
        const clip = getSfxClip(path.basename(planned[0].url, ".wav"))!;
        const expectedPeak =
          planned[0].startFrame / (props.fps ?? 30) + clip.peakOffsetSeconds;
        if (maxEnergy < 1 || Math.abs(peakTime - expectedPeak) > 0.05)
          throw new Error(
            `${engine}: sound peak ${peakTime.toFixed(3)}s missed ${expectedPeak.toFixed(3)}s`,
          );
        await writeFile(
          path.join(output, `${engine}-sound-evidence.json`),
          JSON.stringify(
            { expectedPeak, peakTime, toleranceSeconds: 0.05 },
            null,
            2,
          ),
        );
      }
    }
    const sampleTimes = renderCarousel
      ? [1, 3, 5]
      : renderStockVideo && motionRecipeId
        ? [1, 2.5]
        : [1];
    for (const [sampleIndex, sampleTime] of sampleTimes.entries()) {
      const sample = path.join(
        output,
        sampleIndex === 0
          ? `${engine}-sample.png`
          : `${engine}-sample-${sampleIndex + 1}.png`,
      );
      await run("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        String(sampleTime),
        "-i",
        mp4,
        "-frames:v",
        "1",
        "-y",
        sample,
      ]);
      const stats = (
        await run("ffmpeg", [
          "-hide_banner",
          "-i",
          sample,
          "-vf",
          "signalstats,metadata=print:file=-",
          "-f",
          "null",
          "-",
        ])
      ).stdout;
      if (renderStockVideo && motionRecipeId) {
        // Inspect the center of the media, away from labels and brand chrome.
        // The colorful source fixture must remain visible even after it ends.
        const mediaStats = (
          await run("ffmpeg", [
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            sample,
            "-vf",
            "crop=iw*0.5:ih*0.15:iw*0.25:ih*0.4,signalstats,metadata=print:file=-",
            "-f",
            "null",
            "-",
          ])
        ).stdout;
        const saturation = Number(
          mediaStats.match(/lavfi\.signalstats\.SATAVG=([\d.]+)/)?.[1],
        );
        if (!Number.isFinite(saturation) || saturation < 35)
          throw new Error(
            `${engine}: footage missing at ${sampleTime}s (saturation ${saturation})`,
          );
      }
      const yMax = Number(stats.match(/lavfi\.signalstats\.YMAX=(\d+)/)?.[1]);
      const yMin = Number(stats.match(/lavfi\.signalstats\.YMIN=(\d+)/)?.[1]);
      if (
        !Number.isFinite(yMax) ||
        !Number.isFinite(yMin) ||
        yMax - yMin < 120
      ) {
        throw new Error(
          `${engine}: sampled frame at ${sampleTime}s has no visible foreground`,
        );
      }
    }
  }
  for (const engine of selected as VideoEngineId[]) {
    const mp4 = path.join(output, `${engine}.mp4`);
    const stockVideoUrl =
      engine === "hyperframes" ? "stock-video.mp4" : "/public/stock-video.mp4";
    let engineProps: ReelProps = renderStockVideo
      ? {
          ...props,
          scenes: props.scenes.map((scene, index) =>
            index === 0 && scene.background?.type === "video"
              ? {
                  ...scene,
                  background: { ...scene.background, url: stockVideoUrl },
                }
              : scene,
          ),
        }
      : props;
    if (renderMotionSound) {
      const scenes: SceneDTO[] = engineProps.scenes.map((scene, order) => ({
        ...scene,
        scriptId: "regression",
        order,
        spokenText: null,
        hideText: false,
        selectedVoiceClipId: null,
      }));
      const cues = buildAutomaticSfxCues(scenes);
      const resolved = resolveReelSfxCues({
        sfxEnabled: true,
        sfxJson: JSON.stringify({ enabled: true, cues }),
        timeline: engineProps.timeline,
        fps: engineProps.fps ?? 30,
        videoEngine: engine,
        scenes,
      });
      engineProps = {
        ...engineProps,
        sfxCues: resolved.map((cue) => ({
          ...cue,
          url:
            engine === "hyperframes" ? cue.url.slice(1) : `/public${cue.url}`,
        })),
      };
      await writeFile(
        path.join(output, `${engine}-sfx.json`),
        JSON.stringify(resolved, null, 2),
      );
    }
    if (engine === "hyperframes") {
      const project = path.join(output, "hyperframes");
      await mkdir(project, { recursive: true });
      if (renderStockVideo) {
        await copyFile(stockVideoSource, path.join(project, "stock-video.mp4"));
      }
      if (renderMotionSound) {
        for (const cue of engineProps.sfxCues ?? []) {
          const target = path.join(project, cue.url);
          await mkdir(path.dirname(target), { recursive: true });
          await copyFile(path.resolve("public", cue.url), target);
        }
      }
      const runtime = path.join(project, "_runtime");
      await mkdir(runtime, { recursive: true });
      await copyFile(
        path.resolve("node_modules/gsap/dist/gsap.min.js"),
        path.join(runtime, "gsap.min.js"),
      );
      await Promise.all([
        copyFile(
          path.resolve(
            "node_modules/@fontsource-variable/geist/files",
            HYPERFRAMES_RENDER_FONT_FILES.sans,
          ),
          path.join(runtime, HYPERFRAMES_RENDER_FONT_FILES.sans),
        ),
        copyFile(
          path.resolve(
            "node_modules/@fontsource-variable/geist-mono/files",
            HYPERFRAMES_RENDER_FONT_FILES.mono,
          ),
          path.join(runtime, HYPERFRAMES_RENDER_FONT_FILES.mono),
        ),
      ]);
      await writeFile(
        path.join(project, "index.html"),
        buildHyperframesCompositionHtml(engineProps, {
          producerMode: true,
          runtimeUrl: "/_runtime/gsap.min.js",
        }),
      );
      const result = await run(
        process.execPath,
        ["scripts/hyperframes-render-worker.mjs", project, mp4, "30", "draft"],
        { timeout: 300_000, maxBuffer: 4 * 1024 * 1024 },
      );
      process.stdout.write(result.stdout);
    } else {
      const inputProps: ReelProps =
        renderPreset || renderStockVideo
          ? engineProps
          : {
              ...engineProps,
              scenes: engineProps.scenes.map((scene, index) => ({
                ...scene,
                templateId: index === 0 ? "three" : "lottie",
              })),
            };
      const remotionPublic = path.join(output, "remotion-public");
      if (renderStockVideo) {
        await mkdir(remotionPublic, { recursive: true });
        await copyFile(
          stockVideoSource,
          path.join(remotionPublic, "stock-video.mp4"),
        );
      }
      const serveUrl = await bundle({
        entryPoint: path.resolve("src/remotion/index.ts"),
        webpackOverride: remotionWebpackOverride,
        ...(renderStockVideo ? { publicDir: remotionPublic } : {}),
      });
      const composition = await selectComposition({
        serveUrl,
        id: "Reel",
        inputProps,
      });
      await renderMedia({
        serveUrl,
        composition,
        inputProps,
        outputLocation: mp4,
        codec: "h264",
        concurrency: 2,
        logLevel: "error",
      });
      const stillFrames = renderStockVideo
        ? [Math.floor(props.timeline[0]!.durationFrames / 2)]
        : renderPreset
          ? props.timeline.flatMap((beat) => [
              beat.startFrame,
              beat.startFrame + Math.floor(beat.durationFrames / 2),
            ])
          : [0, 22, 44, 45, 67, 89];
      for (const frame of stillFrames) {
        await renderStill({
          serveUrl,
          composition,
          inputProps,
          frame,
          output: path.join(output, `remotion-${frame}.png`),
          logLevel: "error",
        });
      }
      for (const template of renderPreset || renderStockVideo
        ? []
        : TEMPLATES) {
        const templateProps: ReelProps = {
          ...props,
          scenes: props.scenes.map((scene) => ({
            ...scene,
            templateId: template.id,
          })),
        };
        const templateComposition = await selectComposition({
          serveUrl,
          id: "Reel",
          inputProps: templateProps,
        });
        await renderStill({
          serveUrl,
          composition: templateComposition,
          inputProps: templateProps,
          frame: 30,
          output: path.join(output, `remotion-template-${template.id}.png`),
          logLevel: "error",
        });
      }
    }
    if ((await stat(mp4)).size < 10_000)
      throw new Error(`${engine}: empty render`);
    await verifyForeground(mp4, engine);
    console.log(`${engine}: ${mp4}`);
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
