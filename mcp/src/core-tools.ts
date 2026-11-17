/**
 * The core MCP toolset (roadmap M3): a few high-level tools instead of the
 * multi-step sequence the 88 fine-grained tools need. The descriptions state
 * the workflow in two sentences; the storyboard shape is the Storyboard v1 JSON
 * Schema (resource `reel-studio://schema/storyboard`).
 *
 * Set REEL_STUDIO_MCP_TOOLS=core to expose only these tools.
 */
import { existsSync } from "node:fs";
import path from "node:path";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { RECOMMENDED_KOKORO_VOICES } from "@/providers/voice/kokoro";
import { MUSIC_LIBRARY } from "@/lib/music-library";
import { SCENE_TYPES } from "@/storyboard";
import { THEMES } from "@/video/themes";

import {
  absoluteUrl,
  apiGet,
  apiGetBinary,
  apiPost,
  BASE_URL,
  encode,
} from "./client.js";

type ToolContent =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };
type ToolResult = { content: ToolContent[]; isError?: boolean };

/** What the SDK hands a tool handler besides its arguments. */
interface ToolExtra {
  _meta?: { progressToken?: string | number };
  sendNotification?: (notification: {
    method: "notifications/progress";
    params: {
      progressToken: string | number;
      progress: number;
      total: number;
      message?: string;
    };
  }) => Promise<void>;
}

const json = (data: unknown, image?: ToolContent): ToolResult => ({
  content: [
    { type: "text", text: JSON.stringify(data) },
    ...(image ? [image] : []),
  ],
});

function guard<A>(fn: (args: A, extra: ToolExtra) => Promise<ToolResult>) {
  return async (args: A, extra: ToolExtra = {}): Promise<ToolResult> => {
    try {
      return await fn(args, extra);
    } catch (e) {
      return {
        isError: true,
        content: [
          { type: "text", text: e instanceof Error ? e.message : String(e) },
        ],
      };
    }
  };
}

interface JobView {
  id?: string;
  state: string;
  progress?: number;
  error?: string | null;
  steps?: Array<{ key: string; state: string; error?: string | null }>;
  outputs?: Array<{
    id: string;
    kind: string;
    metadata?: Record<string, unknown> | null;
  }>;
}

const TERMINAL = ["succeeded", "failed", "canceled"];

const STAGE_LABEL: Record<string, string> = {
  validate: "checking the storyboard",
  plan: "planning scenes",
  resolve_media: "finding media",
  synthesize_audio: "recording the narration",
  time_content: "timing captions and scenes",
  prepare_composition: "preparing the video",
  render_export: "rendering",
  verify_artifacts: "checking the file",
};

/** A specific, actionable explanation of a failed stage. */
export function explainFailure(
  stage: string | undefined,
  error: string | null | undefined,
): { stage: string; cause: string; fix: string } {
  const cause = (error ?? "The job failed without a message").slice(0, 400);
  const at = stage ?? "unknown";
  const text = `${cause}`.toLowerCase();
  let fix: string;
  if (/kokoro|onnx|voice model|transformers|\.cache/.test(text))
    fix =
      "The local voice model is missing. Run `npm run voice:download` (about 90 MB), or set voice.enabled to false for a silent video with captions, then call create_video again.";
  else if (/ffmpeg|ffprobe/.test(text))
    fix = "FFmpeg is missing or not on PATH. Install FFmpeg, then retry.";
  else if (/chrome|chromium|puppeteer|browser/.test(text))
    fix =
      "Chrome could not start. Install Google Chrome (or set REEL_VERIFY_CHROME to its path), then retry.";
  else if (/duration|too long|exceeds/.test(text))
    fix =
      "The video is too long. Cut scenes or shorten the narration, then retry.";
  else if (at === "validate" || /storyboard|lint/.test(text))
    fix =
      "The storyboard is not valid. Fix the errors named in the cause (see reel://storyboard/schema), then call create_video again.";
  else if (at === "resolve_media")
    fix =
      "Stock media could not be fetched. Remove the media query from the scene or add a library asset, then retry.";
  else if (at === "synthesize_audio")
    fix =
      "Narration failed. Check the voice settings, or set voice.enabled to false for a silent video.";
  else
    fix = `The ${STAGE_LABEL[at] ?? at} step failed. Retry once with quality "draft"; if it fails the same way, check .data/engine.log.`;
  return { stage: at, cause, fix };
}

const root = path.resolve(import.meta.dirname, "..", "..");

/** Where the finished file is on this computer, when the engine is local. */
export function localFilePath(
  downloadUrl: string | undefined,
): string | undefined {
  if (!downloadUrl) return undefined;
  const key = decodeURIComponent(new URL(downloadUrl).pathname).replace(
    /^\/media\//,
    "",
  );
  for (const candidate of [path.join(root, "media", key), `/${key}`])
    if (existsSync(candidate)) return candidate;
  return undefined;
}

/** Job status with the file, its facts and a contact sheet once it is done. */
export async function describeJob(jobId: string) {
  const body = await apiGet<{ job?: JobView } & JobView>(
    `/api/production-jobs/${encode(jobId)}`,
  );
  const job = body.job ?? body;
  const video = job.outputs?.find((o) => o.kind === "video");
  let videoUrl: string | undefined;
  if (job.state === "succeeded" && video) {
    const artifact = await apiGet<{ artifact?: { downloadUrl?: string } }>(
      `/api/production-jobs/${encode(jobId)}/artifacts/${encode(video.id)}`,
    );
    const link = artifact.artifact?.downloadUrl;
    videoUrl = link ? absoluteUrl(link) : undefined;
  }
  const meta = video?.metadata ?? {};
  const failedStep = job.steps?.find((s) => s.state === "failed");
  return {
    jobId,
    state: job.state,
    progress: Math.round((job.progress ?? 0) * 100),
    stage: job.steps?.find((s) => s.state === "running")?.key,
    error: job.error ?? undefined,
    videoUrl,
    studioUrl: `${BASE_URL}/results/${encode(jobId)}`,
    ...(job.state === "succeeded"
      ? {
          filePath: localFilePath(videoUrl),
          durationSeconds:
            typeof meta.duration === "number"
              ? Math.round(meta.duration * 10) / 10
              : undefined,
          width: typeof meta.width === "number" ? meta.width : undefined,
          height: typeof meta.height === "number" ? meta.height : undefined,
          bytes: typeof meta.bytes === "number" ? meta.bytes : undefined,
          contactSheet:
            typeof meta.contactSheet === "string"
              ? meta.contactSheet
              : undefined,
        }
      : {}),
    ...(job.state === "failed"
      ? {
          failure: explainFailure(
            failedStep?.key,
            failedStep?.error ?? job.error,
          ),
        }
      : {}),
  };
}

/** The contact sheet as an image block, when it exists and is under 1 MB. */
export async function contactSheetImage(view: {
  contactSheet?: string;
}): Promise<ToolContent | undefined> {
  if (!view.contactSheet) return undefined;
  const bytes = await apiGetBinary(
    `/media/${view.contactSheet.replace(/^\/?media\//, "")}`,
  );
  if (!bytes || bytes.length > 1_000_000) return undefined;
  return {
    type: "image",
    data: bytes.toString("base64"),
    mimeType: "image/jpeg",
  };
}

/** Poll a job until it ends or `waitSeconds` pass, reporting progress. */
export async function waitForJob(
  jobId: string,
  waitSeconds: number,
  pollMs = 3000,
  onProgress?: (
    view: Awaited<ReturnType<typeof describeJob>>,
  ) => void | Promise<void>,
) {
  const deadline = Date.now() + waitSeconds * 1000;
  for (;;) {
    const view = await describeJob(jobId);
    await onProgress?.(view);
    if (TERMINAL.includes(view.state) || Date.now() >= deadline) return view;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

/** A progress notification sender, or nothing when the client sent no token. */
function progressReporter(extra: ToolExtra) {
  const token = extra._meta?.progressToken;
  if (token === undefined || !extra.sendNotification) return undefined;
  return async (view: { progress: number; stage?: string }) => {
    await extra.sendNotification!({
      method: "notifications/progress",
      params: {
        progressToken: token,
        progress: view.progress,
        total: 100,
        message: view.stage
          ? (STAGE_LABEL[view.stage] ?? view.stage)
          : undefined,
      },
    }).catch(() => undefined);
  };
}

export function registerCoreTools(server: McpServer): void {
  server.registerTool(
    "create_video",
    {
      description:
        "Make a video from a Storyboard v1 JSON object (read the schema resource first). The studio narrates, animates, captions and renders it locally; with wait=true (default) this returns the finished video link, otherwise a jobId for get_job.",
      inputSchema: {
        storyboard: z.record(z.string(), z.unknown()),
        quality: z.enum(["draft", "standard", "high"]).optional(),
        wait: z.boolean().optional(),
        waitSeconds: z.number().int().min(10).max(1800).optional(),
      },
    },
    guard(async ({ storyboard, quality, wait, waitSeconds }, extra) => {
      const queued = await apiPost<{
        jobId?: string | null;
        projectId?: string;
        reused?: boolean;
        warnings?: unknown[];
        fixes?: unknown[];
      }>(`/api/storyboards?quality=${quality ?? "standard"}`, storyboard);
      if (!queued.jobId) return json(queued);
      const base = {
        projectId: queued.projectId,
        reused: queued.reused,
        fixes: queued.fixes,
        warnings: queued.warnings,
      };
      if (wait === false)
        return json({ ...base, jobId: queued.jobId, state: "queued" });
      const view = await waitForJob(
        queued.jobId,
        waitSeconds ?? 600,
        3000,
        progressReporter(extra),
      );
      return json({ ...base, ...view }, await contactSheetImage(view));
    }),
  );

  server.registerTool(
    "get_job",
    {
      description:
        "Status of a video job: state, progress percent, current stage and, once finished, the video link.",
      inputSchema: { jobId: z.string().min(1) },
    },
    guard(async ({ jobId }) => {
      const view = await describeJob(jobId);
      return json(view, await contactSheetImage(view));
    }),
  );

  server.registerTool(
    "list_options",
    {
      description:
        "Everything a storyboard can choose from, in one compact answer: themes, scene types, formats, qualities, recommended voices and music track ids.",
      inputSchema: {},
    },
    guard(async () =>
      json({
        themes: THEMES.map((t) => ({ id: t.id, use: t.description })),
        sceneTypes: SCENE_TYPES,
        formats: ["9:16", "16:9", "1:1"],
        qualities: ["draft", "standard", "high"],
        voices: RECOMMENDED_KOKORO_VOICES,
        music: MUSIC_LIBRARY.map((track) => track.id),
      }),
    ),
  );

  server.registerTool(
    "list_videos",
    {
      description:
        "Recent videos in the studio: project id, name and scene count.",
      inputSchema: { limit: z.number().int().min(1).max(100).optional() },
    },
    guard(async ({ limit }) => {
      const { projects } = await apiGet<{
        projects: Array<{
          id: string;
          name: string;
          sceneCount: number;
          firstScriptId: string | null;
          archivedAt?: string | null;
        }>;
      }>("/api/projects");
      return json(
        projects
          .filter((p) => !p.archivedAt)
          .slice(0, limit ?? 20)
          .map((p) => ({
            projectId: p.id,
            name: p.name,
            scenes: p.sceneCount,
          })),
      );
    }),
  );

  server.registerTool(
    "open_studio",
    {
      description:
        "The local studio address, or the editor address of one video when projectId is given.",
      inputSchema: { projectId: z.string().min(1).optional() },
    },
    guard(async ({ projectId }) => {
      if (!projectId) return json({ url: BASE_URL });
      const { projects } = await apiGet<{
        projects: Array<{ id: string; firstScriptId: string | null }>;
      }>("/api/projects");
      const scriptId = projects.find((p) => p.id === projectId)?.firstScriptId;
      return json({
        url: scriptId ? `${BASE_URL}/editor/${encode(scriptId)}` : BASE_URL,
      });
    }),
  );
}
