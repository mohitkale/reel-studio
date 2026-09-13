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
import {
  ORIENTATIONS,
  dimsFor,
  type Orientation,
} from "../src/lib/orientation";

async function main() {
  const run = promisify(execFile);
  const args = process.argv.slice(2);
  const presetArg = args.find((arg) => arg.startsWith("--preset="));
  const orientationArg = args.find((arg) => arg.startsWith("--orientation="));
  const orientation = orientationArg?.slice("--orientation=".length);
  if (orientation && !ORIENTATIONS.includes(orientation as Orientation)) {
    throw new Error(`Unknown orientation: ${orientation}`);
  }
  const presetId = args.includes("--product-launch")
    ? "product-launch"
    : presetArg?.slice("--preset=".length);
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
  const renderPreset = Boolean(presetId);
  const renderProductLaunch = presetId === "product-launch";
  const renderDeveloperDemo = presetId === "developer-demo";
  const renderCinematicBrand = presetId === "cinematic-brand";
  const output = orientation
    ? path.resolve(
        ".artifacts/render-regression",
        presetId ?? "legacy",
        orientation,
      )
    : path.resolve(".artifacts/render-regression", presetId ?? "legacy");
  await mkdir(output, { recursive: true });
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
  const selectedFixture = presetId ? presetFixtures[presetId] : fixture;
  const fixtureProps = (
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
  const dimensions = orientation
    ? dimsFor(orientation as Orientation)
    : { width: fixtureProps.width, height: fixtureProps.height };
  const props: ReelProps = {
    ...fixtureProps,
    ...dimensions,
    captions: fixtureProps.captions ?? {
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
    },
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
          "stream=codec_name,width,height",
          "-show_entries",
          "format=duration",
          "-of",
          "json",
          mp4,
        ])
      ).stdout,
    );
    if (
      probe.streams?.[0]?.codec_name !== "h264" ||
      probe.streams[0].width !== props.width ||
      probe.streams[0].height !== props.height ||
      Number(probe.format?.duration) < expectedFrames / (props.fps ?? 30) - 0.2
    ) {
      throw new Error(`${engine}: unexpected output metadata`);
    }
    const sample = path.join(output, `${engine}-sample.png`);
    await run("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      "1",
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
    const yMax = Number(stats.match(/lavfi\.signalstats\.YMAX=(\d+)/)?.[1]);
    const yMin = Number(stats.match(/lavfi\.signalstats\.YMIN=(\d+)/)?.[1]);
    if (!Number.isFinite(yMax) || !Number.isFinite(yMin) || yMax - yMin < 120) {
      throw new Error(`${engine}: sampled frame has no visible foreground`);
    }
  }
  for (const engine of selected) {
    const mp4 = path.join(output, `${engine}.mp4`);
    if (engine === "hyperframes") {
      const project = path.join(output, "hyperframes");
      await mkdir(project, { recursive: true });
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
        buildHyperframesCompositionHtml(props, {
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
      const inputProps: ReelProps = renderPreset
        ? props
        : {
            ...props,
            scenes: props.scenes.map((scene, index) => ({
              ...scene,
              templateId: index === 0 ? "three" : "lottie",
            })),
          };
      const serveUrl = await bundle({
        entryPoint: path.resolve("src/remotion/index.ts"),
        webpackOverride: remotionWebpackOverride,
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
      const stillFrames = renderPreset
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
      for (const template of renderPreset ? [] : TEMPLATES) {
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
