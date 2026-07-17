/**
 * Server-side HyperFrames render path. Builds HTML, then runs
 * @hyperframes/producer in an isolated child process so Puppeteer / producer
 * deps cannot contaminate the Next.js server process.
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
      console.error("[render:hf:worker]", text.trim());
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else {
        reject(
          new Error(
            `HyperFrames worker exited with code ${code}${
              stderr ? `: ${stderr.slice(0, 500)}` : ""
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
    const resolved = resolveReelTimeline(
      script.scenes.map((s) => ({ id: s.id, text: s.text })),
      take,
      script.fps,
    );

    const absolute = (url?: string | null) =>
      url ? (url.startsWith("http") ? url : `${serverBaseUrl}${url}`) : undefined;

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
        hideText: s.hideText ?? script.hideText,
        mood: s.mood as ReelScene["mood"],
        order: s.order,
      })),
      timeline: resolved.timeline,
      width: nativeDims.width,
      height: nativeDims.height,
      fps: script.fps,
      audioUrl: resolved.takeUsable ? absolute(take?.audioUrl) : undefined,
      musicUrl: absolute(script.musicUrl),
      musicVolume: script.musicVolume,
      coverUrl: absolute(script.coverUrl),
      tokens: script.brandTokens,
      hideProgressBar: script.hideProgressBar,
    };

    const html = buildHyperframesCompositionHtml(inputProps);
    const projectDir = path.join(process.cwd(), "media", "hf-work", renderId);
    await fs.mkdir(projectDir, { recursive: true });
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
        progress(pct, "rendering");
        if (Math.round(pct * 100) % 5 === 0) {
          console.log(`[render:hf] Job ${renderId}: ${Math.round(pct * 100)}%`);
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
