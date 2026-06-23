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
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { type ReelProps, REEL_FPS, coverFrames } from "@/compositions/types";
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
  /** Base URL of the Next.js server (e.g. "http://localhost:3000") so Remotion's
   *  Chrome process can fetch the audio take via an absolute URL. */
  serverBaseUrl?: string;
}

/**
 * Kick off a render job in the background (fire and forget from the caller).
 * Progress is tracked in the render queue and persisted to the DB.
 */
export function startRender(opts: StartRenderOptions): void {
  // Run async without awaiting so the HTTP response can return immediately.
  void runRender(opts).catch((err) => {
    console.error("[render] Unhandled error in render job", opts.renderId, err);
  });
}

async function runRender({
  renderId,
  scriptId,
  voiceTakeId,
  serverBaseUrl = "http://localhost:3000",
}: StartRenderOptions): Promise<void> {
  function progress(
    p: number,
    status: "queued" | "bundling" | "rendering" | "done" | "error",
  ) {
    upsertJob({ id: renderId, progress: p, status });
    void updateRenderProgress(renderId, p, status);
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

    // Estimated timeline when no take is selected.
    const { estimateTimeline } = await import("@/lib/preview-timeline");
    const estimated = estimateTimeline(
      script.scenes.map((s) => ({ id: s.id, text: s.text })),
      script.fps,
    );
    const timeline = take?.timeline ?? estimated.timeline;
    const totalFrames = take?.totalFrames ?? estimated.totalFrames;

    // Media URLs must be absolute so Remotion's separate Chrome process (its own
    // webpack dev server) can fetch them — relative URLs resolve against that
    // server, not Next.js.
    const absolute = (url?: string | null) =>
      url ? (url.startsWith("http") ? url : `${serverBaseUrl}${url}`) : undefined;

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
      })),
      timeline,
      audioUrl: absolute(take?.audioUrl),
      coverUrl: absolute(script.coverUrl),
      // script.brandTokens is server-safe (uses serverDefaultTokens, no @remotion/google-fonts).
      // Importing @/compositions/tokens here would pull loadFont() into the Next.js server
      // process where React.createContext is undefined, crashing the render job.
      tokens: script.brandTokens,
    };

    // Cover is held at the start, lengthening the video by that many frames.
    const cover = coverFrames(REEL_FPS, Boolean(script.coverUrl));
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
    await renderMedia({
      composition: { ...composition, durationInFrames: fullDuration },
      serveUrl,
      codec: "h264",
      outputLocation: outputPath,
      inputProps,
      imageFormat: "jpeg",
      pixelFormat: "yuv420p",
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
