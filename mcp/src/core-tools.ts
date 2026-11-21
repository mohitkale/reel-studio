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
  missingPictureFindings,
  reviewStoryboard,
  type Change,
} from "@/storyboard/review";
import { THEMES } from "@/video/themes";

import {
  ApiError,
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

const STAGE_FIX: Record<string, string> = {
  validate:
    "The storyboard is not valid. Fix the fields named in the cause using reel://storyboard/schema, then submit it again.",
  plan: "Check the scenes, their order and the requested format. Open the saved storyboard in Studio, correct the scene named in the cause, and submit it again.",
  resolve_media:
    "Stock media could not be fetched. Remove the failed media query or replace the missing file with a local Library asset, then retry.",
  synthesize_audio:
    "Narration failed. Check the voice settings or select an available voice. Set voice.enabled to false if you want a silent video.",
  time_content:
    "Fix caption cues that end before they start or supply a narration take that matches the scenes, then retry.",
  prepare_composition:
    "Open the storyboard in the editor and check the scene named in the cause. Correct its layout data, or switch it to a plain statement scene, then retry.",
  render_export:
    "Run `reel-studio doctor` to check Chrome, FFmpeg and the local worker. Check the reported cause before retrying the export.",
  verify_artifacts:
    "Check whether the MP4 opens and whether it has its expected audio. Check free disk space, then export a fresh copy.",
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
  if (
    at === "synthesize_audio" &&
    /kokoro|onnx|voice model|transformers/.test(text) &&
    /missing|enoent|not found|not installed|download/.test(text)
  )
    fix =
      "The local voice model is missing. Run `reel-studio doctor --fix` or `npm run voice:download` (about 90 MB), or set voice.enabled to false for a silent video with captions, then call create_video again.";
  else if (
    /ffmpeg|ffprobe/.test(text) &&
    /enoent|missing|not installed|not on path/.test(text)
  )
    fix =
      "FFmpeg is missing or not on PATH. Run `reel-studio doctor --fix` (it asks before downloading), then retry.";
  else if (
    at === "render_export" &&
    /chrome|chromium|puppeteer|browser/.test(text)
  )
    fix =
      "Chrome could not start. Run `reel-studio doctor --fix` (it asks before downloading), or set REEL_VERIFY_CHROME to a Chrome path, then retry.";
  else if (
    at === "time_content" &&
    /too long|exceeds|supports up to/.test(text)
  )
    fix =
      "The video is too long. Cut scenes or shorten the narration, then retry.";
  else
    fix =
      STAGE_FIX[at] ??
      "Open the job in Studio and check its latest step and .data/engine.log before trying again.";
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
  // One folder per video with the MP4, the post text, the storyboard and a thumbnail.
  let outputFolder:
    { folder: string; files: string[]; notes: string[] } | undefined;
  if (job.state === "succeeded") {
    try {
      outputFolder = await apiPost(
        `/api/production-jobs/${encode(jobId)}/export-folder`,
        {},
      );
    } catch {
      // The video is still there without the folder.
    }
  }
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
          outputFolder: outputFolder?.folder,
          outputFiles: outputFolder?.files,
          // 1280x720 PNG made on request from a frame of the video; size=vertical for 1080x1920.
          thumbnailUrl: absoluteUrl(
            `/api/production-jobs/${encode(jobId)}/thumbnail?size=landscape`,
          ),
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
  let queued: {
    jobId?: string | null;
    projectId?: string;
    reused?: boolean;
    warnings?: unknown[];
    fixes?: unknown[];
  };
  try {
    queued = await apiPost(
      `/api/storyboards?quality=${options.quality ?? "standard"}${options.series ? `&series=${encode(options.series)}` : ""}`,
      storyboard,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 422) {
      const issues = z
        .array(z.object({ path: z.string(), message: z.string() }))
        .safeParse(error.issues);
      const cause = issues.data
        ?.slice(0, 3)
        .map(({ path, message }) => `${path}: ${message}`)
        .join("; ");
      return {
        ...json({
          state: "failed",
          failure: explainFailure("validate", cause || error.message),
        }),
        isError: true,
      };
    }
    throw error;
  }
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Turn a recording on this computer into captioned clips: transcribe locally,
 * take the three best passages the studio's plain rules suggest, and export each
 * with a hook title and word-synced captions. Nothing leaves the machine.
 */
async function produceFromRecording(
  source: { path: string; language?: string },
  options: { wait?: boolean; waitSeconds?: number },
): Promise<ToolResult> {
  const { id } = await apiPost<{ id: string }>("/api/recordings", {
    path: source.path,
    ...(source.language ? { language: source.language } : {}),
  });
  if (options.wait === false)
    return json({ recordingId: id, state: "transcribing" });
  const deadline = Date.now() + (options.waitSeconds ?? 900) * 1000;
  type Detail = {
    recording: { status: string; error?: string; name: string };
    suggestions: Array<{
      startWord: number;
      endWord: number;
      title: string;
      seconds: number;
      reasons: string[];
    }>;
  };
  let detail: Detail;
  for (;;) {
    detail = await apiGet<Detail>(`/api/recordings/${encode(id)}`);
    if (detail.recording.status !== "transcribing") break;
    if (Date.now() > deadline)
      return json({
        recordingId: id,
        state: "transcribing",
        note: "Still transcribing; call create_video again later with wait=false, or open the studio at /recordings.",
      });
    await sleep(3000);
  }
  if (detail.recording.status === "failed")
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            recordingId: id,
            state: "failed",
            cause: detail.recording.error,
            fix: "Check that whisper.cpp and its model are set up (reel-studio doctor), then retry.",
          }),
        },
      ],
      isError: true,
    };
  if (detail.suggestions.length === 0)
    return json({
      recordingId: id,
      state: "no-clips",
      note: "No complete 20 to 55 second passage was found.",
    });
  await apiPost(`/api/recordings/${encode(id)}/clips`, {
    clips: detail.suggestions.map((clip) => ({
      startWord: clip.startWord,
      endWord: clip.endWord,
      title: clip.title,
    })),
    trimSilence: true,
    removeFillers: true,
    format: "9:16",
    reframe: "blur",
    quality: "standard",
  });
  type Job = {
    job: {
      state: string;
      step: string;
      error?: string;
      results: Array<{
        title: string;
        seconds: number;
        url: string;
        kit: unknown;
      }>;
    } | null;
  };
  for (;;) {
    const { job } = await apiGet<Job>(`/api/recordings/${encode(id)}/clips`);
    if (job && job.state !== "running")
      return job.state === "failed"
        ? {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  recordingId: id,
                  state: "failed",
                  cause: job.error,
                }),
              },
            ],
            isError: true,
          }
        : json({
            recordingId: id,
            state: "succeeded",
            studioUrl: `${BASE_URL}/recordings`,
            clips: job.results.map((clip) => ({
              title: clip.title,
              seconds: Math.round(clip.seconds),
              videoUrl: absoluteUrl(clip.url),
              localFile: localFilePath(absoluteUrl(clip.url)),
              publishingKit: clip.kit,
            })),
          });
    if (Date.now() > deadline)
      return json({
        recordingId: id,
        state: "running",
        step: job?.step,
        studioUrl: `${BASE_URL}/recordings`,
      });
    await sleep(3000);
  }
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
        "Make a video from a Storyboard v1 JSON object (read the schema resource first). The studio narrates, animates, captions and renders it locally; with wait=true (default) this returns the finished video link, otherwise a jobId for get_job. Or pass source { path } instead of a storyboard to turn a recording on this computer (audio or video) into three captioned 9:16 clips, transcribed locally; list_options reports whether transcription is ready.",
      inputSchema: {
        storyboard: z.record(z.string(), z.unknown()).optional(),
        /** A recording on this computer to turn into captioned clips, instead of a storyboard. */
        source: z
          .object({
            path: z.string().min(1).max(4096),
            language: z.string().min(2).max(12).optional(),
          })
          .optional(),
        quality: z.enum(["draft", "standard", "high"]).optional(),
        wait: z.boolean().optional(),
        waitSeconds: z.number().int().min(10).max(1800).optional(),
        /** Name of a saved series; it fills in the theme, voice, format and music the storyboard leaves out. */
        series: z.string().min(1).max(40).optional(),
      },
    },
    guard(
      ({ storyboard, source, quality, wait, waitSeconds, series }, extra) => {
        if (source) return produceFromRecording(source, { wait, waitSeconds });
        if (!storyboard)
          throw new Error(
            "Give a storyboard, or a source { path } to a recording on this computer.",
          );
        return produce(
          storyboard,
          { quality, wait, waitSeconds, series },
          extra,
        );
      },
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
      // Whether a recording can be transcribed here (whisper.cpp and FFmpeg).
      let transcription: { available: boolean; reason: string | null } = {
        available: false,
        reason: "The studio did not answer.",
      };
      try {
        transcription = (
          await apiGet<{ readiness: typeof transcription }>("/api/recordings")
        ).readiness;
      } catch {
        // Keep the unavailable default.
      }
      return json({
        transcription,
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
      if (latest) {
        const stored = await apiGet<{
          job?: { storyboard?: { warnings?: string[] } };
          storyboard?: { warnings?: string[] };
        }>(`/api/production-jobs/${encode(latest.id)}`);
        review.findings.push(
          ...missingPictureFindings(
            (stored.job ?? stored).storyboard?.warnings ?? [],
          ),
        );
      }
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
