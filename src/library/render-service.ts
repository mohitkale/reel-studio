/**
 * Server-side render service. Bundles the Remotion composition once (cached in
 * memory), then calls renderMedia for each job. Node.js only -- never import
 * this in a client component or edge runtime.
 *
 * FIRST RUN NOTE: renderMedia will download a headless Chromium build (~170 MB)
 * on first use if no system Chrome is available. The download is logged to the
 * terminal and may take a minute; subsequent runs use the cached binary.
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import { cpus } from "node:os";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, type X264Preset } from "@remotion/renderer";
import { type ReelProps, type ReelScene, coverFrames } from "@/compositions/types";
import { type Orientation, dimsFor } from "@/lib/orientation";
import { getAssetStore } from "@/library/storage";
import { getScript } from "@/library/repositories/scripts";
import { listTakes } from "@/library/repositories/takes";
import { normalizeTemplateId } from "@/compositions/templates";
import {
  updateRenderProgress,
  completeRender,
  failRender,
} from "@/library/repositories/renders";
import { upsertJob } from "@/lib/render-queue";

const DEFAULT_RENDER_CONCURRENCY_CAP = 8;
const MIN_PROGRESS_PERSIST_INTERVAL_MS = 1_000;
const MIN_PROGRESS_PERSIST_DELTA = 0.02;
// How many render JOBS may run at once. Each render already spawns a headless
// Chrome with several worker threads, so running multiple in parallel can
// exhaust memory on a modest server. Default to 1 (serial); override via env.
const DEFAULT_MAX_CONCURRENT_RENDERS = 1;

export type RenderQuality = "draft" | "standard" | "high";
export const RENDER_QUALITIES: RenderQuality[] = ["draft", "standard", "high"];
export const DEFAULT_RENDER_QUALITY: RenderQuality = "standard";

/**
 * Draft/High scale the render canvas relative to the orientation's native size
 * (Standard == today's unchanged default). Draft trades resolution + a much
 * faster x264 preset for a near-instant low-fidelity export good for checking
 * timing/pacing; High renders at ~1.33x for a crisper final delivery. Because
 * every template positions content with fixed pixel values (not %-relative),
 * Draft/High will look slightly different in proportion from Standard — the
 * same trade-off the app already makes between portrait/landscape/square.
 */
const QUALITY_PRESETS: Record<
  RenderQuality,
  { scale: number; x264Preset: X264Preset; crf?: number }
> = {
  // scale is passed to renderMedia() — it down/up-scales OUTPUT pixels while
  // keeping the composition coordinate system at the script's native size.
  // Templates use fixed pixel layouts (font sizes, padding) designed for
  // 1080×1920; shrinking width/height in inputProps made draft renders clip text.
  draft: { scale: 0.5, x264Preset: "ultrafast", crf: 30 },
  standard: { scale: 1, x264Preset: "veryfast" },
  high: { scale: 4 / 3, x264Preset: "medium", crf: 16 },
};

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return parsed;
}

function resolveRenderConcurrency(): number {
  const fromEnv = parsePositiveInt(process.env.REMOTION_RENDER_CONCURRENCY);
  if (fromEnv) return fromEnv;

  const cpuCount = cpus().length;
  // Remotion can get slower when concurrency is too high (CPU/memory thrash).
  // Use a conservative, capped default that performs better on most machines.
  return Math.max(
    2,
    Math.min(DEFAULT_RENDER_CONCURRENCY_CAP, Math.floor(cpuCount * 0.75)),
  );
}

// Bundle cache: reuse the same bundle across renders within a process lifetime.
let bundlePath: string | null = null;
let bundlePromise: Promise<string> | null = null;

const ENTRY_POINT = path.resolve(
  process.cwd(),
  "src/remotion/index.ts",
);

async function ensureBundle(
  onStatus: (msg: string) => void,
): Promise<string> {
  if (bundlePath) return bundlePath;
  if (bundlePromise) return bundlePromise;

  bundlePromise = (async () => {
    onStatus("bundling");
    console.log("[render] Bundling Remotion composition (first render only)...");
    const out = await bundle({
      entryPoint: ENTRY_POINT,
      onProgress: (p) => {
        if (p % 20 === 0) console.log(`[render] Bundle progress: ${p}%`);
      },
    });
    console.log("[render] Bundle ready at", out);
    bundlePath = out;
    return out;
  })();

  const result = await bundlePromise;
  bundlePromise = null; // allow retry on failure
  return result;
}

export interface StartRenderOptions {
  renderId: string;
  scriptId: string;
  voiceTakeId?: string;
  /** Override the render canvas to repurpose the same script in another format.
   *  Defaults to the script's own orientation. */
  orientation?: Orientation;
  /** Speed/resolution tradeoff for this job. Defaults to "standard" (unchanged
   *  behavior). See QUALITY_PRESETS for what each tier changes. */
  quality?: RenderQuality;
  /** Base URL of the Next.js server (e.g. "http://localhost:3000") so Remotion's
   *  Chrome process can fetch the audio take via an absolute URL. */
  serverBaseUrl?: string;
}

function resolveMaxConcurrentRenders(): number {
  const fromEnv = parsePositiveInt(process.env.REEL_MAX_CONCURRENT_RENDERS);
  if (fromEnv) return fromEnv;

  // Each concurrent job spawns its own headless Chrome with several worker
  // threads (see resolveRenderConcurrency), so this stays conservative: allow
  // a second simultaneous job only on machines with real headroom (8+ cores),
  // a third on very large boxes (16+). Still 1 by default, matching before.
  const cpuCount = cpus().length;
  if (cpuCount >= 16) return 3;
  if (cpuCount >= 8) return 2;
  return DEFAULT_MAX_CONCURRENT_RENDERS;
}

// Simple in-process job gate. Jobs beyond the cap wait here (their DB row stays
// "queued") until a slot frees, so we never run more renders in parallel than
// the machine can handle.
const pendingRenders: StartRenderOptions[] = [];
let activeRenders = 0;

function pumpRenderQueue(): void {
  const max = resolveMaxConcurrentRenders();
  while (activeRenders < max && pendingRenders.length > 0) {
    const opts = pendingRenders.shift()!;
    activeRenders += 1;
    void runRender(opts)
      .catch((err) => {
        console.error("[render] Unhandled error in render job", opts.renderId, err);
      })
      .finally(() => {
        activeRenders -= 1;
        pumpRenderQueue();
      });
  }
}

/**
 * Kick off a render job in the background (fire and forget from the caller).
 * Honors a concurrency cap: extra jobs wait in a queue (shown as "queued") until
 * a slot is free. Progress is tracked in the render queue and persisted to DB.
 */
export function startRender(opts: StartRenderOptions): void {
  pendingRenders.push(opts);
  if (pendingRenders.length > 1 || activeRenders >= resolveMaxConcurrentRenders()) {
    console.log(
      `[render] Job ${opts.renderId} queued (${activeRenders} running, ${pendingRenders.length} waiting)`,
    );
  }
  pumpRenderQueue();
}

async function runRender({
  renderId,
  scriptId,
  voiceTakeId,
  orientation,
  quality = DEFAULT_RENDER_QUALITY,
  serverBaseUrl = "http://localhost:3000",
}: StartRenderOptions): Promise<void> {
  const qualityPreset = QUALITY_PRESETS[quality];
  let lastPersistedAt = 0;
  let lastPersistedProgress = -1;
  let lastPersistedStatus: "queued" | "bundling" | "rendering" | "done" | "error" = "queued";
  let persistInFlight = false;
  let pendingPersist: {
    progress: number;
    status: "queued" | "bundling" | "rendering" | "done" | "error";
  } | null = null;

  const flushProgressPersist = async () => {
    if (persistInFlight) return;
    persistInFlight = true;
    try {
      while (pendingPersist) {
        const next = pendingPersist;
        pendingPersist = null;
        await updateRenderProgress(renderId, next.progress, next.status);
        lastPersistedAt = Date.now();
        lastPersistedProgress = next.progress;
        lastPersistedStatus = next.status;
      }
    } finally {
      persistInFlight = false;
    }
  };

  const enqueuePersist = (
    p: number,
    status: "queued" | "bundling" | "rendering" | "done" | "error",
  ) => {
    const now = Date.now();
    const shouldForce =
      status !== "rendering" || p <= 0 || p >= 1 || status !== lastPersistedStatus;
    const progressDelta = Math.abs(p - lastPersistedProgress);
    const dueByTime = now - lastPersistedAt >= MIN_PROGRESS_PERSIST_INTERVAL_MS;
    const dueByProgress = progressDelta >= MIN_PROGRESS_PERSIST_DELTA;

    if (!shouldForce && !(dueByTime && dueByProgress)) {
      return;
    }

    pendingPersist = { progress: p, status };
    void flushProgressPersist().catch((err) => {
      console.warn("[render] Progress persist failed", renderId, err);
    });
  };

  function progress(
    p: number,
    status: "queued" | "bundling" | "rendering" | "done" | "error",
  ) {
    upsertJob({ id: renderId, progress: p, status });
    enqueuePersist(p, status);
  }

  try {
    upsertJob({ id: renderId, progress: 0, status: "queued" });

    // 1. Ensure bundle (blocks if another job is bundling simultaneously).
    const serveUrl = await ensureBundle((s) => {
      progress(0, s as "bundling");
    });

    progress(0, "rendering");
    console.log("[render] Starting renderMedia for job", renderId);

    // 2. Load script + optional take.
    const script = await getScript(scriptId);
    if (!script) throw new Error(`Script ${scriptId} not found`);

    const takes = voiceTakeId
      ? await listTakes(scriptId).then((ts) => ts.filter((t) => t.id === voiceTakeId))
      : [];
    const take = takes[0] ?? null;

    // Reconcile the take with the scenes by spoken text (same logic as the
    // editor): a take survives non-text edits and rewrites that keep the text,
    // and falls back to estimated, silent timing otherwise.
    const { resolveReelTimeline } = await import("@/lib/reel-timeline");
    const resolved = resolveReelTimeline(
      script.scenes.map((s) => ({ id: s.id, text: s.text })),
      take,
      script.fps,
    );
    const timeline = resolved.timeline;
    const totalFrames = resolved.totalFrames;

    // Media URLs must be absolute so Remotion's separate Chrome process (its own
    // webpack dev server) can fetch them — relative URLs resolve against that
    // server, not Next.js.
    const absolute = (url?: string | null) =>
      url ? (url.startsWith("http") ? url : `${serverBaseUrl}${url}`) : undefined;

    // Repurpose: render at the requested orientation's canvas instead of the
    // script's own. The composition reads width/height from these input props.
    const nativeDims = orientation
      ? dimsFor(orientation)
      : { width: script.width, height: script.height };
    const outputScale = qualityPreset.scale;

    const inputProps: ReelProps = {
      scenes: script.scenes.map((s) => ({
        id: s.id,
        templateId: normalizeTemplateId(s.templateId),
        text: s.text,
        emphasis: s.emphasis,
        visual: s.visual,
        background: s.background
          ? { ...s.background, url: absolute(s.background.url)! }
          : undefined,
        items: s.items,
        // Per-scene override wins; otherwise the script-wide default.
        hideText: s.hideText ?? script.hideText,
        mood: s.mood as ReelScene["mood"],
        order: s.order,
      })),
      timeline,
      width: nativeDims.width,
      height: nativeDims.height,
      fps: script.fps,
      audioUrl: resolved.takeUsable ? absolute(take?.audioUrl) : undefined,
      musicUrl: absolute(script.musicUrl),
      musicVolume: script.musicVolume,
      coverUrl: absolute(script.coverUrl),
      // script.brandTokens is server-safe (uses serverDefaultTokens, no @remotion/google-fonts).
      // Importing @/compositions/tokens here would pull loadFont() into the Next.js server
      // process where React.createContext is undefined, crashing the render job.
      tokens: script.brandTokens,
      hideProgressBar: script.hideProgressBar,
    };

    // Cover is held at the start, lengthening the video by that many frames.
    const cover = coverFrames(script.fps, Boolean(script.coverUrl));
    const fullDuration = Math.max(1, totalFrames + cover);

    // 3. Resolve the "Reel" composition with input props to get the correct duration.
    const composition = await selectComposition({
      serveUrl,
      id: "Reel",
      inputProps,
    });

    // 4. Output path.
    const store = getAssetStore();
    const fileName = `render-${renderId}.mp4`;
    const outputKey = `renders/${fileName}`;
    // Mirrors LocalDiskStore root (process.cwd()/media).
    const outputPath = path.join(process.cwd(), "media", outputKey);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // 5. Render to MP4.
    // Use adaptive concurrency with an upper cap. Very high concurrency can
    // degrade throughput due to memory pressure and context switching.
    const concurrency = resolveRenderConcurrency();
    const offthreadVideoThreads = Math.max(2, Math.min(4, Math.floor(concurrency / 2)));

    await renderMedia({
      composition: { ...composition, durationInFrames: fullDuration },
      serveUrl,
      codec: "h264",
      outputLocation: outputPath,
      inputProps,
      scale: outputScale,
      imageFormat: "jpeg",
      pixelFormat: "yuv420p",
      concurrency,
      x264Preset: qualityPreset.x264Preset,
      crf: qualityPreset.crf,
      offthreadVideoThreads,
      offthreadVideoCacheSizeInBytes: 512 * 1024 * 1024,
      mediaCacheSizeInBytes: 512 * 1024 * 1024,
      hardwareAcceleration: "if-possible",
      timeoutInMilliseconds: 300_000,
      logLevel: "error",
      onProgress: ({ progress: p }) => {
        const pct = Math.round(p * 100) / 100;
        progress(pct, "rendering");
        if (Math.round(pct * 100) % 5 === 0) {
          console.log(`[render] Job ${renderId}: ${Math.round(pct * 100)}%`);
        }
      },
    });

    // 6. Mark done.
    await completeRender(renderId, outputKey);
    upsertJob({ id: renderId, progress: 1, status: "done", outputUrl: store.url(outputKey) });
    console.log("[render] Job", renderId, "complete:", outputPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[render] Job", renderId, "failed:", msg);
    await failRender(renderId, msg).catch(() => {});
    upsertJob({ id: renderId, progress: 0, status: "error", error: msg });
  }
}
