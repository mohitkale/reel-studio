/** Server-only render orchestration; HyperFrames runs in an isolated worker. */
import { cpus } from "node:os";
import type { VideoSnapshot } from "@/production/video-snapshot";
import type { ResolvedTimeline } from "@/lib/reel-timeline";
import { type ReelProps, type ReelScene, coverFrames } from "@/video/types";
import { normalizeHfTemplateId } from "@/engines/hyperframes/templates";
import { type Orientation, dimsFor } from "@/lib/orientation";
import { resolveReelSfxCues } from "@/lib/sfx-cues";
import { resolveSpokenWordWindows } from "@/lib/spoken-word-windows";
const DEFAULT_MAX_CONCURRENT_RENDERS = 1;
export type RenderQuality = "draft" | "standard" | "high";
export const RENDER_QUALITIES: RenderQuality[] = ["draft", "standard", "high"];
export const DEFAULT_RENDER_QUALITY: RenderQuality = "standard";
export interface StartRenderOptions {
  snapshot?: VideoSnapshot;
  prepared?: { props: ReelProps; totalFrames: number };
  renderId: string;
  scriptId: string;
  voiceTakeId?: string;
  orientation?: Orientation;
  quality?: RenderQuality;
  serverBaseUrl?: string;
}
function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return parsed;
}

function resolveMaxConcurrentRenders(): number {
  const fromEnv = parsePositiveInt(process.env.REEL_MAX_CONCURRENT_RENDERS);
  if (fromEnv) return fromEnv;

  // Each concurrent job spawns its own headless Chrome with several worker
  // threads, so this stays conservative: allow
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
        console.error(
          "[render] Unhandled error in render job",
          opts.renderId,
          err,
        );
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
  if (
    pendingRenders.length > 1 ||
    activeRenders >= resolveMaxConcurrentRenders()
  ) {
    console.log(
      `[render] Job ${opts.renderId} queued (${activeRenders} running, ${pendingRenders.length} waiting)`,
    );
  }
  pumpRenderQueue();
}

async function runRender(opts: StartRenderOptions): Promise<void> {
  const { runHyperframesRender } = await import("@/library/hyperframes-render");
  await runHyperframesRender(opts);
}
/** Await the existing renderer and surface its persisted terminal state. */
export async function runRenderNow(opts: StartRenderOptions): Promise<void> {
  await runRender(opts);
  const { getRender } = await import("@/library/repositories/renders");
  const render = await getRender(opts.renderId);
  if (!render || render.status !== "done" || !render.outputUrl) {
    throw new Error(
      render?.error || `Render ${opts.renderId} did not produce an artifact`,
    );
  }
}

export function prepareVideoComposition(
  snapshot: VideoSnapshot,
  resolved: ResolvedTimeline,
  orientation?: Orientation,
  serverBaseUrl = "http://localhost:3000",
) {
  const { script, take } = snapshot;
  const timeline = resolved.timeline;
  // Resolve media against the app origin before copying it into the render project.
  const absolute = (url?: string | null) =>
    url ? (url.startsWith("http") ? url : `${serverBaseUrl}${url}`) : undefined;

  // Repurpose: render at the requested orientation's canvas instead of the
  // script's own. The composition reads width/height from these input props.
  const nativeDims = orientation
    ? dimsFor(orientation)
    : { width: script.width, height: script.height };

  const inputProps: ReelProps = {
    scenes: script.scenes.map((s) => ({
      id: s.id,
      templateId: normalizeHfTemplateId(s.templateId),
      text: s.text,
      emphasis: s.emphasis,
      visual: s.visual,
      background: s.background
        ? { ...s.background, url: absolute(s.background.url)! }
        : undefined,
      items: s.items,
      chart: s.chart,
      carouselImages: s.carouselImages?.map((url) => absolute(url)!),
      role: s.role,
      motion: s.motion,
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
    sfxCues: resolveReelSfxCues({
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
      timeline,
      fps: script.fps,
    }).map((c) => ({
      ...c,
      url: absolute(snapshot.sfxAssets?.[c.url] ?? c.url)!,
    })),
    coverUrl: absolute(script.coverUrl),
    tokens: script.brandTokens,
    hideProgressBar: script.hideProgressBar,
    styleId: script.styleId,
    energy: script.energy,
    preset: script.productionPreset,
    captions: script.captionTracks?.find((track) => track.enabled),
  };

  // Cover is held at the start, lengthening the video by that many frames.
  const cover = coverFrames(script.fps, Boolean(script.coverUrl));
  const fullDuration = Math.max(1, resolved.totalFrames + cover);

  return { props: inputProps, totalFrames: fullDuration };
}
