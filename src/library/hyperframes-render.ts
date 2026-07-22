/**
 * Server-side HyperFrames render path. Builds HTML, then runs
 * @hyperframes/producer in an isolated child process so Puppeteer / producer
 * deps cannot contaminate the Next.js server process.
 *
 * Local media is copied into the project dir as relative files — HyperFrames
 * refuses plain `http://` URLs (HTTPS-only for remote downloads).
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";

import type { ReelProps, ReelScene } from "@/compositions/types";
import { type Orientation, dimsFor } from "@/lib/orientation";
import { getAssetStore } from "@/library/storage";
import { getScript } from "@/library/repositories/scripts";
import { listTakes } from "@/library/repositories/takes";
import { normalizeHfTemplateId } from "@/engines/hyperframes/templates";
import { buildHyperframesCompositionHtml } from "@/engines/hyperframes/build-composition";
import {
  updateRenderProgress,
  completeRender,
  failRender,
} from "@/library/repositories/renders";
import { upsertJob } from "@/lib/render-queue";

type RenderQuality = "draft" | "standard" | "high";

export interface HyperframesRenderOptions {
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
 * Returns null for true remote URLs that HyperFrames should fetch itself.
 */
function localFsPathForUrl(
  url: string,
  serverBaseUrl: string,
): string | null {
  const stripLeadingSlash = (p: string) => p.replace(/^\/+/, "");

  const fromPathname = (pathname: string): string | null => {
    if (pathname.startsWith("/media/")) {
      return path.join(process.cwd(), stripLeadingSlash(pathname));
    }
    if (pathname.startsWith("/music/")) {
      return path.join(process.cwd(), "public", stripLeadingSlash(pathname));
    }
    return null;
  };

  if (url.startsWith("/") && !url.startsWith("//")) {
    return fromPathname(url);
  }

  try {
    const parsed = new URL(url);
    const base = new URL(serverBaseUrl);
    const localHost =
      parsed.hostname === base.hostname ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1";
    if (localHost) return fromPathname(parsed.pathname);
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Copy local assets into the HyperFrames project and rewrite URLs to relative
 * paths. Leave https:// remotes untouched.
 */
async function materializeUrl(
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
    const ext = path.extname(fsPath) || "";
    const destName = `${assetName}${ext}`;
    const assetsDir = path.join(projectDir, "_assets");
    await fs.mkdir(assetsDir, { recursive: true });
    const dest = path.join(assetsDir, destName);
    await fs.copyFile(fsPath, dest);
    return `_assets/${destName}`;
  }

  if (url.startsWith("https://") || url.startsWith("data:") || url.startsWith("blob:")) {
    return url;
  }

  // HyperFrames blocks http:// remote downloads — fail clearly rather than
  // spending a minute in the pipeline then erroring on audio mix.
  if (url.startsWith("http://")) {
    throw new Error(
      `HyperFrames cannot fetch http:// media (HTTPS only): ${url}. Use a local /media or /music path, or an https URL.`,
    );
  }

  return url;
}

function runWorker(args: {
  projectDir: string;
  outputPath: string;
  fps: number;
  quality: RenderQuality;
  onProgress: (pct: number) => void;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const worker = path.join(
      process.cwd(),
      "scripts/hyperframes-render-worker.mjs",
    );
    const child = spawn(
      process.execPath,
      [worker, args.projectDir, args.outputPath, String(args.fps), args.quality],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

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
      stderr += text;
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
    child.on("close", (code) => {
      if (code === 0) resolve();
      else {
        const detail =
          hfError ||
          stderr
            .split(/\r?\n/)
            .map((l) => l.trim())
            .find((l) => /audio_processing_failed|RenderQualityError|Error:/i.test(l)) ||
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

export async function runHyperframesRender(
  opts: HyperframesRenderOptions,
): Promise<void> {
  const {
    renderId,
    scriptId,
    voiceTakeId,
    orientation,
    quality = "standard",
    serverBaseUrl = "http://localhost:3000",
    onProgress,
  } = opts;

  const progress = (
    p: number,
    status: "queued" | "bundling" | "rendering" | "done" | "error",
  ) => {
    upsertJob({ id: renderId, progress: p, status });
    onProgress?.(p, status);
    void updateRenderProgress(renderId, p, status).catch(() => {});
  };

  try {
    progress(0, "bundling");
    const script = await getScript(scriptId);
    if (!script) throw new Error(`Script ${scriptId} not found`);

    const takes = voiceTakeId
      ? await listTakes(scriptId).then((ts) =>
          ts.filter((t) => t.id === voiceTakeId),
        )
      : [];
    const take = takes[0] ?? null;

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
      script.scenes.map(async (s, i) => {
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

    const inputProps: ReelProps = {
      scenes,
      timeline: resolved.timeline,
      width: nativeDims.width,
      height: nativeDims.height,
      fps: script.fps,
      audioUrl,
      musicUrl,
      musicVolume: script.musicVolume,
      coverUrl,
      tokens: script.brandTokens,
      hideProgressBar: script.hideProgressBar,
      styleId: script.styleId,
      energy: script.energy,
    };

    const html = buildHyperframesCompositionHtml(inputProps);
    await fs.writeFile(path.join(projectDir, "index.html"), html, "utf8");

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
      onProgress: (pct) => {
        // Keep a little headroom so "100%" only lands after completeRender.
        const capped = Math.min(0.99, Math.max(0.02, pct));
        progress(capped, "rendering");
        if (Math.round(capped * 100) % 5 === 0) {
          console.log(`[render:hf] Job ${renderId}: ${Math.round(capped * 100)}%`);
        }
      },
    });

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
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[render:hf] Job", renderId, "failed:", msg);
    await failRender(renderId, msg).catch(() => {});
    upsertJob({ id: renderId, progress: 0, status: "error", error: msg });
  }
}
