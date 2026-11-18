/**
 * The core MCP toolset (roadmap M3): a few high-level tools instead of the
 * multi-step sequence the 88 fine-grained tools need. The descriptions state
 * the workflow in two sentences; the storyboard shape is the Storyboard v1 JSON
 * Schema (resource `reel-studio://schema/storyboard`).
 *
 * These are the default toolset; REEL_STUDIO_MCP_TOOLS=all adds every other tool.
 */
import { existsSync } from "node:fs";
import path from "node:path";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { RECOMMENDED_KOKORO_VOICES } from "@/providers/voice/kokoro";
import { MUSIC_LIBRARY } from "@/lib/music-library";
import { SCENE_TYPES } from "@/storyboard";
import {
  applyChanges,
  reviewStoryboard,
  type Change,
} from "@/storyboard/review";
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
      "The local voice model is missing. Run `reel-studio doctor --fix` or `npm run voice:download` (about 90 MB), or set voice.enabled to false for a silent video with captions, then call create_video again.";
  else if (/ffmpeg|ffprobe/.test(text))
    fix =
      "FFmpeg is missing or not on PATH. Run `reel-studio doctor --fix` (it asks before downloading), then retry.";
  else if (/chrome|chromium|puppeteer|browser/.test(text))
    fix =
      "Chrome could not start. Run `reel-studio doctor --fix` (it asks before downloading), or set REEL_VERIFY_CHROME to a Chrome path, then retry.";
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

/** Queue a storyboard and, unless wait is false, wait for the finished video. */
async function produce(
  storyboard: Record<string, unknown>,
  options: {
    quality?: string;
    wait?: boolean;
    waitSeconds?: number;
    series?: string;
  },
  extra: ToolExtra,
): Promise<ToolResult> {
  const queued = await apiPost<{
    jobId?: string | null;
    projectId?: string;
    reused?: boolean;
    warnings?: unknown[];
    fixes?: unknown[];
  }>(
    `/api/storyboards?quality=${options.quality ?? "standard"}${options.series ? `&series=${encode(options.series)}` : ""}`,
    storyboard,
  );
  if (!queued.jobId) return json(queued);
  const base = {
    projectId: queued.projectId,
    reused: queued.reused,
    fixes: queued.fixes,
    warnings: queued.warnings,
  };
  if (options.wait === false)
    return json({ ...base, jobId: queued.jobId, state: "queued" });
  const view = await waitForJob(
    queued.jobId,
    options.waitSeconds ?? 600,
    3000,
    progressReporter(extra),
  );
  return json({ ...base, ...view }, await contactSheetImage(view));
}

interface PodcastJobView {
  job: {
    status: string;
    scene: number;
    sceneCount: number;
    error: string | null;
    podcastTake: {
      id: string;
      totalFrames: number;
      fps: number;
      mp3Url?: string | null;
      audioUrl?: string | null;
    } | null;
  };
}

/** Where an episode is, and once it is done, its files and the package link. */
export async function describePodcastJob(podcastId: string, jobId: string) {
  const { job } = await apiGet<PodcastJobView>(
    `/api/podcasts/${encode(podcastId)}/takes/${encode(jobId)}`,
  );
  const done = job.status === "done" && job.podcastTake;
  const take = job.podcastTake;
  return {
    jobId,
    podcastId,
    state: done
      ? "succeeded"
      : job.status === "error"
        ? "failed"
        : job.status === "queued"
          ? "queued"
          : "running",
    progress: job.sceneCount
      ? Math.round((job.scene / job.sceneCount) * 100)
      : 0,
    stage: job.status,
    studioUrl: `${BASE_URL}/podcasts/${encode(podcastId)}`,
    ...(done && take
      ? {
          takeId: take.id,
          durationSeconds: Math.round((take.totalFrames / take.fps) * 10) / 10,
          audioUrl: take.audioUrl ? absoluteUrl(take.audioUrl) : undefined,
          mp3Url: take.mp3Url ? absoluteUrl(take.mp3Url) : undefined,
          // WAV and MP3, transcript, chapters, show notes and a manifest in one .tar.gz.
          packageUrl: absoluteUrl(
            `/api/podcast-takes/${encode(take.id)}/bundle`,
          ),
        }
      : {}),
    ...(job.status === "error"
      ? {
          failure: explainFailure("synthesize_audio", job.error ?? undefined),
        }
      : {}),
  };
}

/** Queue a podcast storyboard and, unless wait is false, wait for the finished episode. */
async function producePodcast(
  storyboard: Record<string, unknown>,
  options: { wait?: boolean; waitSeconds?: number },
  extra: ToolExtra,
): Promise<ToolResult> {
  const queued = await apiPost<{
    jobId?: string | null;
    podcastId?: string;
    warnings?: unknown[];
    fixes?: unknown[];
  }>("/api/storyboards", { ...storyboard, kind: "podcast" });
  if (!queued.jobId || !queued.podcastId) return json(queued);
  const base = { fixes: queued.fixes, warnings: queued.warnings };
  if (options.wait === false)
    return json({
      ...base,
      jobId: queued.jobId,
      podcastId: queued.podcastId,
      state: "queued",
    });
  const deadline = Date.now() + (options.waitSeconds ?? 900) * 1000;
  const report = progressReporter(extra);
  for (;;) {
    const view = await describePodcastJob(queued.podcastId, queued.jobId);
    await report?.({ progress: view.progress, stage: view.stage });
    if (TERMINAL.includes(view.state) || Date.now() >= deadline)
      return json({ ...base, ...view });
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

/** The first script of a project and its storyboard export. */
async function exportedStoryboard(projectId: string) {
  const { projects } = await apiGet<{
    projects: Array<{ id: string; firstScriptId: string | null }>;
  }>("/api/projects");
  const scriptId = projects.find((p) => p.id === projectId)?.firstScriptId;
  if (!scriptId) throw new Error(`No project with id ${projectId}`);
  const result = await apiGet<{
    storyboard?: Record<string, unknown>;
    notes?: string[];
  }>(`/api/scripts/${encode(scriptId)}/storyboard`);
  if (!result.storyboard)
    throw new Error("This project cannot be exported as a storyboard");
  return { scriptId, storyboard: result.storyboard, notes: result.notes ?? [] };
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
        /** Name of a saved series; it fills in the theme, voice, format and music the storyboard leaves out. */
        series: z.string().min(1).max(40).optional(),
      },
    },
    guard(({ storyboard, quality, wait, waitSeconds, series }, extra) =>
      produce(storyboard, { quality, wait, waitSeconds, series }, extra),
    ),
  );

  server.registerTool(
    "create_podcast",
    {
      description:
        'Make a podcast episode from a Storyboard v1 JSON object with kind "podcast" (speakers and turns; read reel://authoring/podcast first). The studio speaks each turn with the speaker\'s voice, adds intro and outro music, masters to -16 LUFS and returns the episode links, including one .tar.gz package with WAV, MP3, transcript, chapters and show notes. With wait=true (default) it returns when the episode is done.',
      inputSchema: {
        storyboard: z.record(z.string(), z.unknown()),
        wait: z.boolean().optional(),
        waitSeconds: z.number().int().min(10).max(3600).optional(),
      },
    },
    guard(({ storyboard, wait, waitSeconds }, extra) =>
      producePodcast(storyboard, { wait, waitSeconds }, extra),
    ),
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
    guard(async () => {
      // Saved series are named sets of defaults; a failed lookup just means none.
      let saved: { series?: Array<{ name: string }> } = {};
      try {
        saved =
          (await apiGet<{ series?: Array<{ name: string }> }>("/api/series")) ??
          {};
      } catch {
        // No studio answer for series: list the rest.
      }
      return json({
        series: (saved.series ?? []).map((item) => item.name),
        themes: THEMES.map((t) => ({ id: t.id, use: t.description })),
        sceneTypes: SCENE_TYPES,
        formats: ["9:16", "16:9", "1:1"],
        qualities: ["draft", "standard", "high"],
        voices: RECOMMENDED_KOKORO_VOICES,
        music: MUSIC_LIBRARY.map((track) => track.id),
      });
    }),
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

  server.registerTool(
    "review_video",
    {
      description:
        "Look over a finished video's storyboard: findings phrased as the edit that fixes each one (long headlines, repeated scene types, missing hook or close), pacing per scene, and the latest contact sheet image. Fix what it names with revise_video, once.",
      inputSchema: { projectId: z.string().min(1) },
    },
    guard(async ({ projectId }) => {
      const { scriptId, storyboard } = await exportedStoryboard(projectId);
      const review = reviewStoryboard(storyboard);
      const { jobs } = await apiGet<{
        jobs: Array<{
          id: string;
          state: string;
          revision?: { scriptId?: string } | null;
        }>;
      }>("/api/production-jobs?limit=50");
      const latest = jobs.find(
        (j) => j.state === "succeeded" && j.revision?.scriptId === scriptId,
      );
      const view = latest ? await describeJob(latest.id) : undefined;
      return json(
        {
          projectId,
          ...review,
          latestVideo: view,
          frameCheck:
            "Layout checks run on the finished frames (npm run examples:lint-frames); review_video does not run them yet, so look at the contact sheet for clipped or crowded text.",
        },
        view ? await contactSheetImage(view) : undefined,
      );
    }),
  );

  server.registerTool(
    "revise_video",
    {
      description:
        "Change a finished video's storyboard and make it again, or with derive=\"shorts\" cut it into three to five vertical shorts (self-contained runs with a hook and a closing line). changes is a list of edits to scenes counted from 1: {op:'update',index,fields}, {op:'replace',index,scene}, {op:'insert',index,scene}, {op:'remove',index}, {op:'move',from,to}; set changes top-level fields such as title or theme. Creates a new video (the whole video is rendered again).",
      inputSchema: {
        projectId: z.string().min(1),
        changes: z
          .array(
            z.discriminatedUnion("op", [
              z.object({
                op: z.literal("update"),
                index: z.number().int(),
                fields: z.record(z.string(), z.unknown()),
              }),
              z.object({
                op: z.literal("replace"),
                index: z.number().int(),
                scene: z.record(z.string(), z.unknown()),
              }),
              z.object({
                op: z.literal("insert"),
                index: z.number().int(),
                scene: z.record(z.string(), z.unknown()),
              }),
              z.object({ op: z.literal("remove"), index: z.number().int() }),
              z.object({
                op: z.literal("move"),
                from: z.number().int(),
                to: z.number().int(),
              }),
            ]),
          )
          .default([]),
        set: z.record(z.string(), z.unknown()).optional(),
        quality: z.enum(["draft", "standard", "high"]).optional(),
        wait: z.boolean().optional(),
        /** "shorts" cuts the video into three to five vertical shorts instead of editing it. */
        derive: z.literal("shorts").optional(),
        count: z.number().int().min(1).max(5).optional(),
        maxSeconds: z.number().min(10).max(90).optional(),
      },
    },
    guard(
      async (
        { projectId, changes, set, quality, wait, derive, count, maxSeconds },
        extra,
      ) => {
        if (derive === "shorts") {
          const { scriptId } = await exportedStoryboard(projectId);
          const made = await apiPost<{
            shorts: Array<{
              title: string;
              seconds: number;
              jobId?: string | null;
              projectId?: string | null;
            }>;
          }>(`/api/scripts/${encode(scriptId)}/cutdowns`, {
            count,
            maxSeconds,
            quality: quality ?? "standard",
          });
          return json({
            projectId,
            derived: "shorts",
            shorts: made.shorts.map((short) => ({
              ...short,
              studioUrl: short.jobId
                ? `${BASE_URL}/results/${encode(short.jobId)}`
                : undefined,
            })),
            next: "Each short is a job; call get_job with its jobId until it is done.",
          });
        }
        const { storyboard } = await exportedStoryboard(projectId);
        const revised = applyChanges(storyboard, changes as Change[], set);
        return produce(
          revised as Record<string, unknown>,
          { quality, wait },
          extra,
        );
      },
    ),
  );
}
