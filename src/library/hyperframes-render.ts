import { copyHyperframesRuntime } from "@/library/hyperframes-runtime";
import { downloadPublicMediaToFile } from "@/server/public-media-download";
import { productionSignal } from "@/library/production-cancellation";
import { randomUUID } from "node:crypto";
import { createProgressWriter } from "@/library/progress-writer";
import { writeHyperframesVisualSections } from "@/library/hyperframes-visual-sections";
import type { VideoSnapshot } from "@/production/video-snapshot";
import {
  masterVideoAudio,
  audioMasteringReportPath,
} from "@/library/video-audio-mastering";
import {
  assertProductionActive,
  cancelChild,
} from "@/library/production-cancellation";
/**
 * Server-side HyperFrames render path. Builds HTML, then runs
 * @hyperframes/producer in an isolated child process so Puppeteer / producer
 * deps cannot contaminate the Next.js server process.
 *
 * Local and eligible remote media are copied into the project as relative files.
 * Public network downloads happen through the server DNS/byte/deadline guards.
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";

import { coverFrames, type ReelProps, type ReelScene } from "@/video/types";
import { extendHyperframesMusic } from "@/library/hyperframes-music-loop";
import { type Orientation, dimsFor } from "@/lib/orientation";
import { getAssetStore } from "@/library/storage";
import { sanitizeKey } from "@/library/storage/local-disk";
import { getScript } from "@/library/repositories/scripts";
import { listTakes } from "@/library/repositories/takes";
import { normalizeHfTemplateId } from "@/engines/hyperframes/templates";
import { buildHyperframesCompositionHtml } from "@/engines/hyperframes/build-composition";
import { getCatalogBlockByTemplateId } from "@/engines/hyperframes/catalog/manifest";
import { catalogCompositionFileName } from "@/engines/hyperframes/catalog/build-scene";
import { personalizeCatalogBlock } from "@/engines/hyperframes/catalog/personalize";
import { defaultBrandTokens } from "@/video/tokens";
import {
  updateRenderProgress,
  completeRender,
  failRender,
} from "@/library/repositories/renders";
import { upsertJob } from "@/lib/render-queue";
import { assertPathInsideRoot } from "@/server/url-safety";
import { localizeHyperframesRenderFonts } from "@/engines/hyperframes/render-fonts";

type RenderQuality = "draft" | "standard" | "high";

import { LOCALIZABLE_GSAP_URLS } from "@/engines/hyperframes/runtime";
const GSAP_RENDER_URL = "/_runtime/gsap.min.js";

function localizeGsapRuntime(html: string): string {
  return LOCALIZABLE_GSAP_URLS.reduce(
    (localized, url) => localized.replaceAll(url, GSAP_RENDER_URL),
    html,
  );
}

export interface HyperframesRenderOptions {
  snapshot?: VideoSnapshot;
  prepared?: { props: ReelProps; totalFrames: number };
  renderId: string;
  scriptId: string;
  voiceTakeId?: string;
  orientation?: Orientation;
  quality?: RenderQuality;
  serverBaseUrl?: string;
  onProgress?: (
    p: number,
    status: "queued" | "bundling" | "rendering" | "done" | "error",
  ) => void;
}

/**
 * Map a media URL to a path on disk under this app (media/ or public/).
 * Returns null for remote URLs that require the DNS-pinned downloader.
 */
export function localFsPathForUrl(
  url: string,
  serverBaseUrl: string,
): string | null {
  const stripLeadingSlash = (p: string) => p.replace(/^\/+/, "");

  const fromPathname = (pathname: string): string | null => {
    try {
      if (pathname.startsWith("/media/")) {
        const key = sanitizeKey(
          stripLeadingSlash(pathname.slice("/media".length)),
        );
        const mediaRoot = path.join(process.cwd(), "media");
        return assertPathInsideRoot(mediaRoot, path.join(mediaRoot, key));
      }
      if (pathname.startsWith("/music/")) {
        const key = sanitizeKey(
          stripLeadingSlash(pathname.slice("/music".length)),
        );
        const musicRoot = path.join(process.cwd(), "public", "music");
        return assertPathInsideRoot(musicRoot, path.join(musicRoot, key));
      }
    } catch {
      return null;
    }
    return null;
  };

  if (url.startsWith("/") && !url.startsWith("//")) {
    try {
      return fromPathname(decodeURIComponent(url));
    } catch {
      return null;
    }
  }

  try {
    const parsed = new URL(url);
    const base = new URL(serverBaseUrl);
    const localHost =
      ["http:", "https:"].includes(parsed.protocol) &&
      !parsed.username &&
      !parsed.password &&
      parsed.origin === base.origin;
    if (localHost) return fromPathname(decodeURIComponent(parsed.pathname));
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Copy local assets into the HyperFrames project and rewrite URLs to relative
 * paths. Remote assets use bounded DNS-pinned downloads before Chromium starts.
 */
export async function materializeUrl(
  url: string | undefined | null,
  projectDir: string,
  assetName: string,
  serverBaseUrl: string,
): Promise<string | undefined> {
  if (!url) return undefined;

  const fsPath = localFsPathForUrl(url, serverBaseUrl);
  if (fsPath) {
    try {
      await fs.access(fsPath);
    } catch {
      throw new Error(`Local media missing for HyperFrames render: ${fsPath}`);
    }
    const parsed = new URL(url, serverBaseUrl);
    const root = path.join(
      process.cwd(),
      parsed.pathname.startsWith("/media/") ? "media" : "public/music",
    );
    const real = assertPathInsideRoot(
      await fs.realpath(root),
      await fs.realpath(fsPath),
    );
    const ext = path.extname(real) || "";
    const destName = `${assetName}${ext}`;
    const assetsDir = path.join(projectDir, "_assets");
    await fs.mkdir(assetsDir, { recursive: true });
    const dest = path.join(assetsDir, destName);
    assertProductionActive();
    await fs.copyFile(real, dest);
    return `_assets/${destName}`;
  }

  const assetsDir = path.join(projectDir, "_assets");
  await fs.mkdir(assetsDir, { recursive: true });
  const temporary = path.join(assetsDir, `${randomUUID()}.tmp`);
  try {
    const media = await downloadPublicMediaToFile(url, temporary, {
      signal: productionSignal(),
    });
    const destName = `${assetName}.${media.extension}`;
    assertProductionActive();
    await fs.rename(temporary, path.join(assetsDir, destName));
    return `_assets/${destName}`;
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

async function runWorker(args: {
  projectDir: string;
  outputPath: string;
  fps: number;
  quality: RenderQuality;
  sections?: { width: number; height: number };
  onProgress: (pct: number) => void;
}): Promise<void> {
  assertProductionActive();
  const scratch = `${args.projectDir}-sections`;
  if (args.sections) await fs.mkdir(scratch, { recursive: true });
  return new Promise((resolve, reject) => {
    const worker = path.join(
      process.cwd(),
      "scripts/hyperframes-render-worker.mjs",
    );
    const child = spawn(
      process.execPath,
      [
        ...(args.sections ? ["--import", "tsx"] : []),
        worker,
        args.projectDir,
        args.outputPath,
        String(args.fps),
        args.quality,
        ...(args.sections
          ? [
              "sections",
              String(args.sections.width),
              String(args.sections.height),
            ]
          : []),
      ],
      {
        detached: process.platform !== "win32",
        cwd: process.cwd(),
        env: args.sections
          ? { ...process.env, TMPDIR: scratch, TMP: scratch, TEMP: scratch }
          : process.env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    const waitForCleanup = cancelChild(child);
    let stderr = "";
    let hfError = "";
    child.stdout.on("data", (buf: Buffer) => {
      const text = buf.toString("utf8");
      for (const line of text.split(/\r?\n/)) {
        if (line.startsWith("HF_PROGRESS ")) {
          const pct = Number(line.slice("HF_PROGRESS ".length));
          if (Number.isFinite(pct)) args.onProgress(pct);
        } else if (line.trim()) {
          console.log("[render:hf:worker]", line.trim());
        }
      }
    });
    child.stderr.on("data", (buf: Buffer) => {
      const text = buf.toString("utf8");
      stderr = (stderr + text).slice(-65_536);
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith("HF_ERROR ")) {
          hfError = trimmed.slice("HF_ERROR ".length);
        }
        console.error("[render:hf:worker]", trimmed);
      }
    });
    child.on("error", reject);
    child.on("close", async (code) => {
      try {
        await waitForCleanup();
      } catch (error) {
        reject(error);
        return;
      }
      if (code === 0) resolve();
      else {
        const detail =
          hfError ||
          stderr
            .split(/\r?\n/)
            .map((l) => l.trim())
            .find((l) =>
              /audio_processing_failed|RenderQualityError|Error:/i.test(l),
            ) ||
          stderr.slice(0, 400);
        reject(
          new Error(
            `HyperFrames worker exited with code ${code}${
              detail ? `: ${detail}` : ""
            }`,
          ),
        );
      }
    });
  });
}

/** Write the same runtime, fonts, catalog and HTML used by export. */
async function writeHyperframesProject(
  projectDir: string,
  inputProps: ReelProps,
) {
  const scenes = inputProps.scenes;
  const runtimeDir = path.join(projectDir, "_runtime");
  await fs.mkdir(runtimeDir, { recursive: true });
  await copyHyperframesRuntime(runtimeDir);

  // Materialize curated catalog blocks as compositions/*.html so the producer
  // can resolve data-composition-src on the host index.html.
  const tokens = inputProps.tokens ?? defaultBrandTokens;
  const catalogScenes = scenes.filter((s) =>
    getCatalogBlockByTemplateId(s.templateId, inputProps.catalogRevision),
  );
  if (catalogScenes.length) {
    const compositionsDir = path.join(projectDir, "compositions");
    await fs.mkdir(compositionsDir, { recursive: true });
    for (const scene of catalogScenes) {
      const meta = getCatalogBlockByTemplateId(
        scene.templateId,
        inputProps.catalogRevision,
      );
      if (!meta) continue;
      if (meta.requiresCarouselImages) continue;
      const personalized = personalizeCatalogBlock(meta, {
        scene,
        tokens,
      });
      await fs.writeFile(
        path.join(
          compositionsDir,
          catalogCompositionFileName(meta.id, scene.id),
        ),
        localizeHyperframesRenderFonts(localizeGsapRuntime(personalized)),
        "utf8",
      );
    }
  }

  const fps = inputProps.fps || 30;
  const durationFrames =
    (Math.max(
      0,
      ...inputProps.timeline.map(
        (beat) => beat.startFrame + beat.durationFrames,
      ),
    ) || fps) + coverFrames(fps, Boolean(inputProps.coverUrl));
  const musicUrl = await extendHyperframesMusic(
    projectDir,
    inputProps.musicUrl,
    durationFrames / fps,
  );
  const html = buildHyperframesCompositionHtml(
    { ...inputProps, musicUrl },
    {
      producerMode: true,
      runtimeUrl: GSAP_RENDER_URL,
    },
  );
  await fs.writeFile(path.join(projectDir, "index.html"), html, "utf8");
}

/** Review uses silent export props, with project-owned media localized identically. */
export async function writeHyperframesReviewProject(
  projectDir: string,
  props: ReelProps,
  serverBaseUrl: string,
) {
  await fs.mkdir(projectDir, { recursive: true });
  const scenes = await Promise.all(
    props.scenes.map(async (scene, index) => ({
      ...scene,
      background: scene.background
        ? {
            ...scene.background,
            url: (await materializeUrl(
              scene.background.url,
              projectDir,
              `bg-${index}`,
              serverBaseUrl,
            ))!,
          }
        : undefined,
      carouselImages: await Promise.all(
        (scene.carouselImages ?? []).map(
          async (url, imageIndex) =>
            (await materializeUrl(
              url,
              projectDir,
              `carousel-${index}-${imageIndex}`,
              serverBaseUrl,
            ))!,
        ),
      ),
    })),
  );
  const coverUrl = await materializeUrl(
    props.coverUrl,
    projectDir,
    "cover",
    serverBaseUrl,
  );
  await writeHyperframesProject(projectDir, {
    ...props,
    scenes,
    coverUrl,
    audioUrl: undefined,
    musicUrl: undefined,
    sfxCues: [],
  });
}

export async function runHyperframesRender(
  opts: HyperframesRenderOptions,
): Promise<void> {
  const {
    snapshot,
    prepared,
    renderId,
    scriptId,
    voiceTakeId,
    orientation,
    quality = "standard",
    serverBaseUrl = "http://localhost:3000",
    onProgress,
  } = opts;

  const writer = createProgressWriter<{
    progress: number;
    status: Parameters<typeof updateRenderProgress>[2];
  }>((value) => updateRenderProgress(renderId, value.progress, value.status));
  let previousStatus: string | undefined;
  const progress = (
    p: number,
    status: "queued" | "bundling" | "rendering" | "done" | "error",
  ) => {
    upsertJob({ id: renderId, progress: p, status });
    onProgress?.(p, status);
    writer.push({ progress: p, status }, previousStatus !== status);
    previousStatus = status;
  };

  try {
    progress(0, "bundling");
    const script = snapshot?.script ?? (await getScript(scriptId));
    if (!script) throw new Error(`Script ${scriptId} not found`);

    const takes = voiceTakeId
      ? await listTakes(scriptId).then((ts) =>
          ts.filter((t) => t.id === voiceTakeId),
        )
      : [];
    const take = snapshot ? snapshot.take : (takes[0] ?? null);

    const { resolveReelTimeline } = await import("@/lib/reel-timeline");
    const { resolveSpokenText } = await import("@/lib/spoken-text");
    const resolved = resolveReelTimeline(
      script.scenes.map((s) => ({ id: s.id, text: resolveSpokenText(s) })),
      take,
      script.fps,
    );

    const nativeDims = orientation
      ? dimsFor(orientation)
      : { width: script.width, height: script.height };

    const projectDir = path.join(process.cwd(), "media", "hf-work", renderId);
    await fs.mkdir(projectDir, { recursive: true });

    const scenes = await Promise.all(
      (prepared?.props.scenes ?? script.scenes).map(async (s, i) => {
        const bgUrl = s.background?.url
          ? await materializeUrl(
              s.background.url.startsWith("http")
                ? s.background.url
                : `${serverBaseUrl}${s.background.url}`,
              projectDir,
              `bg-${i}`,
              serverBaseUrl,
            )
          : undefined;
        const carouselImages = await Promise.all(
          (s.carouselImages ?? []).map(async (url, imageIndex) =>
            materializeUrl(
              url.startsWith("http") ? url : `${serverBaseUrl}${url}`,
              projectDir,
              `carousel-${i}-${imageIndex}`,
              serverBaseUrl,
            ),
          ),
        );
        return {
          id: s.id,
          templateId: normalizeHfTemplateId(s.templateId),
          text: s.text,
          emphasis: s.emphasis,
          visual: s.visual,
          background: s.background
            ? { ...s.background, url: bgUrl ?? s.background.url }
            : undefined,
          items: s.items,
          chart: s.chart,
          carouselImages: carouselImages.filter((url): url is string =>
            Boolean(url),
          ),
          role: s.role,
          motion: s.motion,
          direction: s.direction,
          hideText: s.hideText ?? script.hideText,
          mood: s.mood as ReelScene["mood"],
          order: s.order,
        };
      }),
    );

    const audioUrl = resolved.takeUsable
      ? await materializeUrl(
          take?.audioUrl
            ? take.audioUrl.startsWith("http")
              ? take.audioUrl
              : `${serverBaseUrl}${take.audioUrl}`
            : undefined,
          projectDir,
          "vo",
          serverBaseUrl,
        )
      : undefined;

    const musicUrl = await materializeUrl(
      script.musicUrl
        ? script.musicUrl.startsWith("http")
          ? script.musicUrl
          : `${serverBaseUrl}${script.musicUrl}`
        : undefined,
      projectDir,
      "music",
      serverBaseUrl,
    );

    const { resolveReelSfxCues } = await import("@/lib/sfx-cues");
    const { resolveSpokenWordWindows } =
      await import("@/lib/spoken-word-windows");
    const rawSfx =
      prepared?.props.sfxCues ??
      resolveReelSfxCues({
        sfxEnabled: script.sfxEnabled,
        sfxJson: script.sfxJson,
        scenes: script.scenes,
        videoEngine: script.videoEngine,
        hideText: script.hideText,
        spokenWords: resolveSpokenWordWindows(
          script.captionTracks,
          resolved.takeUsable ? take?.id : null,
          script.fps,
        ),
        timeline: resolved.timeline,
        fps: script.fps,
      });
    const sfxCues = await Promise.all(
      rawSfx.map(async (cue, i) => ({
        ...cue,
        url:
          (await materializeUrl(
            cue.url.startsWith("http") ? cue.url : `${serverBaseUrl}${cue.url}`,
            projectDir,
            `sfx-${i}`,
            serverBaseUrl,
          )) ?? cue.url,
      })),
    );

    const coverUrl = await materializeUrl(
      script.coverUrl
        ? script.coverUrl.startsWith("http")
          ? script.coverUrl
          : `${serverBaseUrl}${script.coverUrl}`
        : undefined,
      projectDir,
      "cover",
      serverBaseUrl,
    );

    const legacyInputProps: ReelProps = {
      scenes,
      timeline: prepared?.props.timeline ?? resolved.timeline,
      spokenWords: resolveSpokenWordWindows(script.captionTracks, resolved.takeUsable ? take?.id : null, script.fps),
      width: nativeDims.width,
      height: nativeDims.height,
      fps: script.fps,
      audioUrl,
      musicUrl,
      musicVolume: script.musicVolume,
      sfxCues,
      coverUrl,
      tokens: script.brandTokens,
      hideProgressBar: script.hideProgressBar,
      styleId: script.styleId,
      energy: script.energy,
      preset: script.productionPreset,
      captions: script.captionTracks?.find((track) => track.enabled),
    };

    const inputProps: ReelProps = prepared
      ? { ...prepared.props, scenes, audioUrl, musicUrl, sfxCues, coverUrl }
      : legacyInputProps;

    await writeHyperframesProject(projectDir, inputProps);
    if (script.chapterPlan && [24, 30, 60].includes(script.fps))
      await writeHyperframesVisualSections(projectDir, inputProps);

    const store = getAssetStore();
    const fileName = `render-${renderId}.mp4`;
    const outputKey = `renders/${fileName}`;
    const outputPath = path.join(process.cwd(), "media", outputKey);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    progress(0.02, "rendering");
    console.log("[render:hf] Starting HyperFrames worker", renderId);

    await runWorker({
      projectDir,
      outputPath,
      fps: script.fps,
      quality,
      sections:
        script.chapterPlan && [24, 30, 60].includes(script.fps)
          ? nativeDims
          : undefined,
      onProgress: (pct) => {
        // Keep a little headroom so "100%" only lands after completeRender.
        const capped = Math.min(
          script.audioMastering === "balanced" ? 0.96 : 0.99,
          Math.max(0.02, pct),
        );
        progress(capped, "rendering");
        if (Math.round(capped * 100) % 5 === 0) {
          console.log(
            `[render:hf] Job ${renderId}: ${Math.round(capped * 100)}%`,
          );
        }
      },
    });

    await masterVideoAudio(outputPath, script.audioMastering);
    assertProductionActive();
    await writer.flush();
    await writer.stop();
    await completeRender(renderId, outputKey);
    upsertJob({
      id: renderId,
      progress: 1,
      status: "done",
      outputUrl: store.url(outputKey),
    });
    console.log("[render:hf] Job", renderId, "complete:", outputPath);

    await fs.rm(projectDir, { recursive: true, force: true }).catch(() => {});
  } catch (err) {
    await writer.stop();
    await fs.rm(
      audioMasteringReportPath(
        path.join(process.cwd(), "media", "renders", `render-${renderId}.mp4`),
      ),
      { force: true },
    );
    await fs.rm(
      path.join(process.cwd(), "media", "renders", `render-${renderId}.mp4`),
      { force: true },
    );
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[render:hf] Job", renderId, "failed:", msg);
    await failRender(renderId, msg).catch(() => {});
    upsertJob({ id: renderId, progress: 0, status: "error", error: msg });
  } finally {
    await writer.stop();
    await fs.rm(path.join(process.cwd(), "media", "hf-work", renderId), {
      recursive: true,
      force: true,
    });
    await fs.rm(
      path.join(process.cwd(), "media", "hf-work", `${renderId}-sections`),
      { recursive: true, force: true },
    );
  }
}
