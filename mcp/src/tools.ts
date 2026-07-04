import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  apiGet,
  apiGetText,
  apiPatch,
  apiPost,
  absoluteUrl,
  encode,
} from "./client.js";

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

function ok(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function text(message: string): ToolResult {
  return { content: [{ type: "text", text: message }] };
}

/** Wrap a handler so thrown errors surface as a clean tool error, not a crash. */
function guard<A>(fn: (args: A) => Promise<ToolResult>) {
  return async (args: A): Promise<ToolResult> => {
    try {
      return await fn(args);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
    }
  };
}

const orientation = z.enum(["portrait", "landscape", "square"]);
const scriptStyle = z.enum(["short", "detailed"]);
const sceneMood = z.enum([
  "energetic",
  "calm",
  "dramatic",
  "playful",
  "inspiring",
  "tech",
  "nature",
]);

const backgroundShape = z.object({
  type: z.enum(["image", "video"]),
  url: z.string().min(1).max(2048),
  effect: z
    .enum(["ken-burns", "pan-left", "pan-right", "pan-up", "pan-down"])
    .optional(),
  muted: z.boolean().optional(),
});

export function registerTools(server: McpServer): void {
  /* ---- Read tools ---- */

  server.registerTool(
    "list_projects",
    {
      description:
        "List all projects (id, name, scene/script counts). Start here to find a project to work on.",
      inputSchema: {},
    },
    guard(async () => ok(await apiGet("/api/projects"))),
  );

  server.registerTool(
    "get_script",
    {
      description:
        "Get a script with all of its scenes, voice takes and brand tokens. Use this to read the full storyboard before editing.",
      inputSchema: { scriptId: z.string().min(1) },
    },
    guard(async ({ scriptId }) =>
      ok(await apiGet(`/api/scripts/${encode(scriptId)}`)),
    ),
  );

  server.registerTool(
    "list_takes",
    {
      description: "List the voice takes generated for a script.",
      inputSchema: { scriptId: z.string().min(1) },
    },
    guard(async ({ scriptId }) =>
      ok(await apiGet(`/api/scripts/${encode(scriptId)}/takes`)),
    ),
  );

  server.registerTool(
    "get_captions",
    {
      description:
        "Get the script's subtitles as SRT or WebVTT text. Timing matches the rendered video (uses the given take's measured timing, or estimated when none). Useful to review or hand back caption files.",
      inputSchema: {
        scriptId: z.string().min(1),
        format: z.enum(["srt", "vtt"]).default("srt"),
        takeId: z.string().optional(),
      },
    },
    guard(async ({ scriptId, format, takeId }) => {
      const qs = new URLSearchParams({ format });
      if (takeId) qs.set("takeId", takeId);
      return text(
        await apiGetText(`/api/scripts/${encode(scriptId)}/captions?${qs.toString()}`),
      );
    }),
  );

  server.registerTool(
    "list_renders",
    {
      description:
        "List render jobs, optionally filtered to one script. Use to poll a render's status after request_render.",
      inputSchema: { scriptId: z.string().optional() },
    },
    guard(async ({ scriptId }) =>
      ok(
        await apiGet(
          `/api/renders${scriptId ? `?scriptId=${encode(scriptId)}` : ""}`,
        ),
      ),
    ),
  );

  server.registerTool(
    "get_render",
    {
      description:
        "Get one render's current status and progress (poll this until status is 'done').",
      inputSchema: { renderId: z.string().min(1) },
    },
    guard(async ({ renderId }) =>
      ok(await apiGet(`/api/renders/${encode(renderId)}`)),
    ),
  );

  server.registerTool(
    "list_voice_providers",
    {
      description:
        "List available voice (TTS) providers and which are configured, plus the default provider/model.",
      inputSchema: {},
    },
    guard(async () => ok(await apiGet("/api/providers"))),
  );

  server.registerTool(
    "list_voices",
    {
      description: "List voices for a voice provider, optionally filtered by a query.",
      inputSchema: {
        providerId: z.string().min(1),
        query: z.string().optional(),
      },
    },
    guard(async ({ providerId, query }) =>
      ok(
        await apiGet(
          `/api/providers/${encode(providerId)}/voices${query ? `?q=${encode(query)}` : ""}`,
        ),
      ),
    ),
  );

  server.registerTool(
    "list_voice_models",
    {
      description: "List models for a voice provider.",
      inputSchema: { providerId: z.string().min(1) },
    },
    guard(async ({ providerId }) =>
      ok(await apiGet(`/api/providers/${encode(providerId)}/models`)),
    ),
  );

  server.registerTool(
    "list_ai_providers",
    {
      description:
        "List AI 'director' providers (gemini, openai) and whether a key is configured. Keys are set in the website only.",
      inputSchema: {},
    },
    guard(async () => ok(await apiGet("/api/ai/providers"))),
  );

  /* ---- Create / edit tools ---- */

  server.registerTool(
    "create_project",
    {
      description: "Create a new empty project and its first script.",
      inputSchema: {
        name: z.string().trim().min(1).max(120),
        orientation: orientation.optional(),
      },
    },
    guard(async (args) => ok(await apiPost("/api/projects", args))),
  );

  server.registerTool(
    "ai_create_project",
    {
      description:
        "Generate a full scene plan from a brief and create a new project. Requires an AI key configured in the website. For large storyboards, create a smaller plan then extend with ai_generate_scenes (append) or add_scene.",
      inputSchema: {
        providerId: z.enum(["gemini", "openai"]),
        modelId: z.string().optional(),
        mode: z.enum(["idea", "story"]),
        brief: z.string().trim().min(3).max(8000),
        sceneCount: z.number().int().min(3).max(20).optional(),
        orientation: orientation.optional(),
        scriptStyle: scriptStyle
          .optional()
          .describe(
            "'short' = punchy ~18 words/scene (default). 'detailed' = richer ~30-45 words/scene with a fuller story arc.",
          ),
      },
    },
    guard(async (args) => ok(await apiPost("/api/projects/ai", args))),
  );

  server.registerTool(
    "assign_brand_kit",
    {
      description: "Assign (or clear with null) a brand kit for a project.",
      inputSchema: {
        projectId: z.string().min(1),
        brandKitId: z.string().nullable(),
      },
    },
    guard(async ({ projectId, brandKitId }) =>
      ok(await apiPatch(`/api/projects/${encode(projectId)}`, { brandKitId })),
    ),
  );

  server.registerTool(
    "update_script",
    {
      description: "Update a script's name and/or cover frame URL.",
      inputSchema: {
        scriptId: z.string().min(1),
        name: z.string().trim().min(1).max(120).optional(),
        coverUrl: z.string().max(2048).nullable().optional(),
      },
    },
    guard(async ({ scriptId, ...body }) =>
      ok(await apiPatch(`/api/scripts/${encode(scriptId)}`, body)),
    ),
  );

  server.registerTool(
    "set_music",
    {
      description:
        "Set or clear the reel's background music and/or its volume (0-100). Music is mixed under the voiceover and auto-ducked while scenes are spoken. Audio files are uploaded in the web app; pass an existing asset/media URL, or null to remove the track.",
      inputSchema: {
        scriptId: z.string().min(1),
        musicUrl: z.string().max(2048).nullable().optional(),
        musicVolume: z.number().int().min(0).max(100).optional(),
      },
    },
    guard(async ({ scriptId, musicUrl, musicVolume }) => {
      const body: Record<string, unknown> = {};
      if (musicUrl !== undefined) body.musicUrl = musicUrl;
      if (musicVolume !== undefined) body.musicVolume = musicVolume;
      return ok(await apiPatch(`/api/scripts/${encode(scriptId)}`, body));
    }),
  );

  server.registerTool(
    "add_scene",
    {
      description:
        "Append one scene to a script. Use this to build a storyboard incrementally. See the reel://authoring/rules resource for template and text rules.",
      inputSchema: {
        scriptId: z.string().min(1),
        text: z.string().max(2000).optional(),
        templateId: z.string().optional(),
      },
    },
    guard(async ({ scriptId, ...body }) =>
      ok(await apiPost(`/api/scripts/${encode(scriptId)}/scenes`, body)),
    ),
  );

  server.registerTool(
    "update_scene",
    {
      description:
        "Update fields of one scene. emphasis phrases must appear verbatim in text. Pass null to clear visual/background/items.",
      inputSchema: {
        sceneId: z.string().min(1),
        text: z.string().max(2000).optional(),
        templateId: z.string().optional(),
        emphasis: z.array(z.string()).optional(),
        visual: z.string().max(2048).nullable().optional(),
        background: backgroundShape.nullable().optional(),
        items: z.array(z.string().max(280)).max(24).nullable().optional(),
        mood: sceneMood
          .nullable()
          .optional()
          .describe(
            "Emotional/visual tone driving the dynamic background treatment when there's no background image. Null clears it.",
          ),
        musicMood: z
          .string()
          .max(60)
          .nullable()
          .optional()
          .describe("Short music vibe hint (e.g. 'uplifting lo-fi'), used for auto music suggestions. Null clears it."),
      },
    },
    guard(async ({ sceneId, ...body }) =>
      ok(await apiPatch(`/api/scenes/${encode(sceneId)}`, body)),
    ),
  );

  server.registerTool(
    "reorder_scenes",
    {
      description:
        "Reorder a script's scenes. Pass all scene ids in the desired order.",
      inputSchema: {
        scriptId: z.string().min(1),
        orderedIds: z.array(z.string()).min(1),
      },
    },
    guard(async ({ scriptId, orderedIds }) =>
      ok(
        await apiPatch(`/api/scripts/${encode(scriptId)}/scenes`, { orderedIds }),
      ),
    ),
  );

  server.registerTool(
    "ai_generate_scenes",
    {
      description:
        "Use the AI director to append new scenes or fully rewrite a script's scenes. 'append' is the safe way to extend a storyboard in chunks (existing scenes are untouched); 'rewrite' replaces ALL scenes. Requires an AI key configured in the website.",
      inputSchema: {
        scriptId: z.string().min(1),
        providerId: z.enum(["gemini", "openai"]),
        modelId: z.string().optional(),
        mode: z.enum(["rewrite", "append"]),
        brief: z.string().trim().min(3).max(4000),
        sceneCount: z.number().int().min(2).max(20).optional(),
        scriptStyle: scriptStyle
          .optional()
          .describe(
            "'short' = punchy ~18 words/scene (default). 'detailed' = richer ~30-45 words/scene with a fuller story arc.",
          ),
      },
    },
    guard(async ({ scriptId, ...body }) =>
      ok(await apiPost(`/api/scripts/${encode(scriptId)}/ai`, body)),
    ),
  );

  server.registerTool(
    "create_voice_take",
    {
      description:
        "Start generating a voice take (narration) for a script with a chosen provider+voice. Set placeholder:true for silent timing without spending TTS credits. Server-side providers require a key configured in the website. This does NOT block until finished: it returns a jobId immediately — poll get_voice_job with it until status is 'done' (the finished take is included in that response) or 'error'.",
      inputSchema: {
        scriptId: z.string().min(1),
        providerId: z.enum(["cartesia", "elevenlabs"]).optional(),
        voiceId: z.string().optional(),
        modelId: z.string().optional(),
        placeholder: z.boolean().optional(),
        label: z.string().max(120).optional(),
      },
    },
    guard(async ({ scriptId, ...body }) =>
      ok(await apiPost(`/api/scripts/${encode(scriptId)}/takes`, body)),
    ),
  );

  server.registerTool(
    "get_voice_job",
    {
      description:
        "Poll the status of a voice-generation job started by create_voice_take. status progresses queued -> synthesizing -> stitching -> done|error; scene/sceneCount give per-scene synthesis progress. The finished take is included once status is 'done'.",
      inputSchema: {
        scriptId: z.string().min(1),
        jobId: z.string().min(1),
      },
    },
    guard(async ({ scriptId, jobId }) =>
      ok(await apiGet(`/api/scripts/${encode(scriptId)}/takes/${encode(jobId)}`)),
    ),
  );

  server.registerTool(
    "rename_take",
    {
      description: "Rename a voice take.",
      inputSchema: {
        takeId: z.string().min(1),
        label: z.string().trim().min(1).max(120),
      },
    },
    guard(async ({ takeId, label }) =>
      ok(await apiPatch(`/api/takes/${encode(takeId)}`, { label })),
    ),
  );

  server.registerTool(
    "rename_render",
    {
      description: "Rename a render.",
      inputSchema: {
        renderId: z.string().min(1),
        name: z.string().max(120),
      },
    },
    guard(async ({ renderId, name }) =>
      ok(await apiPatch(`/api/renders/${encode(renderId)}`, { name })),
    ),
  );

  /* ---- Render (human-gated) ---- */

  server.registerTool(
    "request_render",
    {
      description:
        "Request that a script be rendered to video, optionally with a specific voice take. This does NOT start the render: it creates a pending request that the human must verify and approve in the Reel Studio web app (Renders page). Poll get_render until status is 'done', then call download_render.",
      inputSchema: {
        scriptId: z.string().min(1),
        voiceTakeId: z.string().optional(),
        /** Speed/resolution tradeoff. Omit for "standard" (the default). */
        quality: z.enum(["draft", "standard", "high"]).optional(),
      },
    },
    guard(async (args) => {
      const res = await apiPost<{ render: { id: string; status: string } }>(
        "/api/renders",
        args,
      );
      return ok({
        ...res,
        message:
          "Render queued for human approval. Ask the user to open Reel Studio → Renders and click 'Approve & Render'. Then poll get_render with this renderId until status is 'done'.",
        approveUrl: absoluteUrl("/renders"),
      });
    }),
  );

  server.registerTool(
    "download_render",
    {
      description:
        "Get the downloadable MP4 URL for a finished render. Returns the output URL when status is 'done', otherwise reports the current status.",
      inputSchema: { renderId: z.string().min(1) },
    },
    guard(async ({ renderId }) => {
      const res = await apiGet<{
        render: { status: string; outputUrl: string | null; error: string | null };
      }>(`/api/renders/${encode(renderId)}`);
      const r = res.render;
      if (r.status === "done" && r.outputUrl) {
        return ok({ status: r.status, downloadUrl: absoluteUrl(r.outputUrl) });
      }
      if (r.status === "error") {
        return text(`Render failed: ${r.error ?? "unknown error"}`);
      }
      return text(
        `Render is not ready yet (status: ${r.status}). Poll get_render until it is 'done'.`,
      );
    }),
  );
}
