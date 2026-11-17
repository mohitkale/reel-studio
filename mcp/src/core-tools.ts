/**
 * The core MCP toolset (roadmap M3): a few high-level tools instead of the
 * multi-step sequence the 88 fine-grained tools need. The descriptions state
 * the workflow in two sentences; the storyboard shape is the Storyboard v1 JSON
 * Schema (resource `reel-studio://schema/storyboard`).
 *
 * Set REEL_STUDIO_MCP_TOOLS=core to expose only these tools.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { RECOMMENDED_KOKORO_VOICES } from "@/providers/voice/kokoro";
import { MUSIC_LIBRARY } from "@/lib/music-library";
import { SCENE_TYPES } from "@/storyboard";
import { THEMES } from "@/video/themes";

import { absoluteUrl, apiGet, apiPost, BASE_URL, encode } from "./client.js";

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

const json = (data: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data) }],
});

function guard<A>(fn: (args: A) => Promise<ToolResult>) {
  return async (args: A): Promise<ToolResult> => {
    try {
      return await fn(args);
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
  steps?: Array<{ key: string; state: string }>;
  outputs?: Array<{ id: string; kind: string }>;
}

const TERMINAL = ["succeeded", "failed", "canceled"];

/** Job status with a download link for the finished video. */
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
  return {
    jobId,
    state: job.state,
    progress: Math.round((job.progress ?? 0) * 100),
    stage: job.steps?.find((s) => s.state === "running")?.key,
    error: job.error ?? undefined,
    videoUrl,
  };
}

/** Poll a job until it ends or `waitSeconds` pass. */
export async function waitForJob(
  jobId: string,
  waitSeconds: number,
  pollMs = 3000,
) {
  const deadline = Date.now() + waitSeconds * 1000;
  for (;;) {
    const view = await describeJob(jobId);
    if (TERMINAL.includes(view.state) || Date.now() >= deadline) return view;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
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
    guard(async ({ storyboard, quality, wait, waitSeconds }) => {
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
      return json({
        ...base,
        ...(await waitForJob(queued.jobId, waitSeconds ?? 600)),
      });
    }),
  );

  server.registerTool(
    "get_job",
    {
      description:
        "Status of a video job: state, progress percent, current stage and, once finished, the video link.",
      inputSchema: { jobId: z.string().min(1) },
    },
    guard(async ({ jobId }) => json(await describeJob(jobId))),
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
