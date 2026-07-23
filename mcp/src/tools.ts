import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  apiGet,
  apiGetText,
  apiPatch,
  apiPost,
  apiPut,
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
/** Whole-reel Style look (Coral Harbor / Style+Energy system). */
const styleId = z.enum(["bold-hook", "clean-story", "teach-me", "soft-brand"]);
const energy = z.enum(["calm", "normal", "high"]);
const voiceMode = z.enum(["oneshot", "per_scene"]);
const sceneMood = z.enum([
  "energetic",
  "calm",
  "dramatic",
  "playful",
  "inspiring",
  "tech",
  "nature",
]);
/** Server-side TTS providers MCP can drive without browser upload. */
const serverVoiceProvider = z.enum(["cartesia", "elevenlabs", "voiceforge"]);

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

  const videoEngine = z
    .enum(["remotion", "hyperframes"])
    .optional()
    .describe(
      "Video composition engine. 'remotion' (default) or 'hyperframes' (Apache-2.0 HTML engine). Fixed at project creation.",
    );

  server.registerTool(
    "create_project",
    {
      description:
        "Create a new empty project and its first script. Pass videoEngine='hyperframes' for the commercially open HTML engine.",
      inputSchema: {
        name: z.string().trim().min(1).max(120),
        orientation: orientation.optional(),
        videoEngine,
      },
    },
    guard(async (args) => ok(await apiPost("/api/projects", args))),
  );

  server.registerTool(
    "ai_create_project",
    {
      description:
        "Generate a full scene plan from a brief and create a new project. Requires an AI key configured in the website. For large storyboards, create a smaller plan then extend with ai_generate_scenes (append) or add_scene. Pass videoEngine='hyperframes' to use HyperFrames-native templates. scriptStyle='detailed' writes short on-screen text plus longer spokenText for voiceover.",
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
            "'short' = punchy on-screen ~14-18 words/scene; voice uses the same text (default). 'detailed' = short on-screen text + longer spokenText (~30-55 words) for narration.",
          ),
        styleId: z
          .enum(["auto", "bold-hook", "clean-story", "teach-me", "soft-brand"])
          .optional()
          .describe(
            "Whole-reel Style look. 'auto' lets the AI choose; omit defaults to bold-hook.",
          ),
        energy: z
          .enum(["auto", "calm", "normal", "high"])
          .optional()
          .describe(
            "Whole-reel Energy (motion intensity). 'auto' lets the AI choose; omit defaults to normal.",
          ),
        videoEngine,
      },
    },
    guard(async (args) => ok(await apiPost("/api/projects/ai", args))),
  );

  server.registerTool(
    "list_video_engines",
    {
      description:
        "List supported video engines (remotion, hyperframes) and their template catalogs. Use before create_project when choosing an engine.",
      inputSchema: {},
    },
    guard(async () =>
      ok({
        engines: [
          {
            id: "remotion",
            label: "Remotion",
            license: "Remotion License (source-available)",
            templates: [
              "kinetic",
              "lottie",
              "three",
              "stat-reveal",
              "icon-grid",
              "quote-card",
              "emoji-punch",
            ],
          },
          {
            id: "hyperframes",
            label: "HyperFrames",
            license: "Apache-2.0",
            templates: [
              "hf-opener",
              "hf-statement",
              "hf-list",
              "hf-stat",
              "hf-quote",
              "hf-cta",
            ],
            note: "Renders via self-hosted @hyperframes/producer (Node >= 22). HeyGen hosted MCP is not used.",
          },
        ],
      }),
    ),
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
      description:
        "Update a script's name, cover, Style/Energy look, and/or voiceMode. voiceMode 'oneshot' = one full-reel take; 'per_scene' = generate/select clips per scene then assemble.",
      inputSchema: {
        scriptId: z.string().min(1),
        name: z.string().trim().min(1).max(120).optional(),
        coverUrl: z.string().max(2048).nullable().optional(),
        styleId: styleId
          .optional()
          .describe("Whole-reel Style: bold-hook | clean-story | teach-me | soft-brand."),
        energy: energy
          .optional()
          .describe("Whole-reel Energy: calm | normal | high."),
        voiceMode: voiceMode
          .optional()
          .describe("'oneshot' (default) or 'per_scene' for clip-per-scene workflow."),
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
        "Update fields of one scene. text = on-screen copy; spokenText = optional longer voiceover (null = inherit text). emphasis phrases must appear verbatim in text or spokenText. Pass null to clear visual/background/items/spokenText.",
      inputSchema: {
        sceneId: z.string().min(1),
        text: z.string().max(2000).optional(),
        spokenText: z
          .string()
          .max(4000)
          .nullable()
          .optional()
          .describe(
            "Voice script. Null clears override so TTS uses text. Empty string is treated as no speech for that scene.",
          ),
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
        selectedVoiceClipId: z
          .string()
          .nullable()
          .optional()
          .describe(
            "In per_scene mode, select which SceneVoiceClip is active for this scene (null clears). Selecting a clip may trigger assemble.",
          ),
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
            "'short' = punchy on-screen text; voice inherits. 'detailed' = short on-screen + longer spokenText for TTS.",
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
        "Start a oneshot voice take (full-reel narration) for a script. Prefer this when voiceMode is oneshot. Set placeholder:true for silent timing without spending TTS credits. Server-side providers require a key in the website. Returns jobId immediately — poll get_voice_job until status is 'done' or 'error'. For per-scene clips use generate_scene_clips instead.",
      inputSchema: {
        scriptId: z.string().min(1),
        providerId: serverVoiceProvider.optional(),
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
        "Poll a oneshot voice job from create_voice_take. status: queued -> synthesizing -> stitching -> done|error. The finished take is included when status is 'done'.",
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
    "list_scene_clips",
    {
      description:
        "List per-scene voice clips for a script (per_scene voiceMode). Each scene can have multiple clip versions; selectedVoiceClipId on the scene marks the active one.",
      inputSchema: { scriptId: z.string().min(1) },
    },
    guard(async ({ scriptId }) =>
      ok(await apiGet(`/api/scripts/${encode(scriptId)}/scene-clips`)),
    ),
  );

  server.registerTool(
    "generate_scene_clips",
    {
      description:
        "Generate a new voice clip for every scene in parallel, select each newest clip, and assemble a VoiceTake. Set the script voiceMode to per_scene first via update_script. Returns jobId — poll get_scene_clips_job until done. Use placeholder:true for silent holds without TTS credits.",
      inputSchema: {
        scriptId: z.string().min(1),
        providerId: serverVoiceProvider.optional(),
        voiceId: z.string().optional(),
        modelId: z.string().optional(),
        placeholder: z.boolean().optional(),
        label: z.string().max(120).optional(),
      },
    },
    guard(async ({ scriptId, ...body }) =>
      ok(
        await apiPost(`/api/scripts/${encode(scriptId)}/scene-clips`, body),
      ),
    ),
  );

  server.registerTool(
    "get_scene_clips_job",
    {
      description:
        "Poll a generate_scene_clips job. When status is 'done', response includes the assembled take and clips.",
      inputSchema: {
        scriptId: z.string().min(1),
        jobId: z.string().min(1),
      },
    },
    guard(async ({ scriptId, jobId }) =>
      ok(
        await apiGet(
          `/api/scripts/${encode(scriptId)}/scene-clips/${encode(jobId)}`,
        ),
      ),
    ),
  );

  server.registerTool(
    "assemble_scene_clips",
    {
      description:
        "Stitch currently selected per-scene clips into a VoiceTake (source=assembled). Call after selecting clips via update_scene.selectedVoiceClipId, or after generate_scene_clips finishes.",
      inputSchema: { scriptId: z.string().min(1) },
    },
    guard(async ({ scriptId }) =>
      ok(
        await apiPost(
          `/api/scripts/${encode(scriptId)}/scene-clips/assemble`,
          {},
        ),
      ),
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

  /* ---- Podcasts (audio-only; no deletes) ---- */

  const podcastLength = z.enum(["short", "long"]);
  const podcastGender = z.enum(["male", "female", "neutral"]);
  const podcastCharacterInput = z.object({
    id: z.string().optional(),
    key: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .optional()
      .describe("Stable JSON id used in dialogue (e.g. host, guest)."),
    name: z.string().trim().min(1).max(80),
    gender: podcastGender,
    definition: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .describe(
        "Personality/role brief for AI script writing only — does not change TTS voice.",
      ),
    providerId: z.string().optional(),
    voiceId: z.string().optional(),
    modelId: z.string().nullable().optional(),
  });

  server.registerTool(
    "list_podcasts",
    {
      description:
        "List audio-only podcasts (id, title, character/turn/take counts). Separate from video projects.",
      inputSchema: {},
    },
    guard(async () => ok(await apiGet("/api/podcasts"))),
  );

  server.registerTool(
    "get_podcast",
    {
      description:
        "Get one podcast with characters, dialogue turns, and takes. Use before editing cast, script, or generating audio.",
      inputSchema: { podcastId: z.string().min(1) },
    },
    guard(async ({ podcastId }) =>
      ok(await apiGet(`/api/podcasts/${encode(podcastId)}`)),
    ),
  );

  server.registerTool(
    "create_podcast",
    {
      description:
        "Create an audio-only podcast episode with a default 2-character cast. Then set voices via update_podcast_characters and generate a script.",
      inputSchema: {
        title: z.string().trim().min(1).max(120).optional(),
        description: z.string().trim().max(2000).optional(),
        length: podcastLength
          .optional()
          .describe("'short' or 'long' target episode length for AI scripts."),
      },
    },
    guard(async (args) => ok(await apiPost("/api/podcasts", args))),
  );

  server.registerTool(
    "update_podcast",
    {
      description: "Update podcast title, description, and/or length.",
      inputSchema: {
        podcastId: z.string().min(1),
        title: z.string().trim().min(1).max(120).optional(),
        description: z.string().trim().max(2000).optional(),
        length: podcastLength.optional(),
      },
    },
    guard(async ({ podcastId, ...body }) =>
      ok(await apiPatch(`/api/podcasts/${encode(podcastId)}`, body)),
    ),
  );

  server.registerTool(
    "replace_podcast_characters",
    {
      description:
        "Replace the full cast (2–4 characters). WARNING: clears the current script turns. Prefer update_podcast_characters to change voices/names without wiping dialogue.",
      inputSchema: {
        podcastId: z.string().min(1),
        characters: z.array(podcastCharacterInput).min(2).max(4),
      },
    },
    guard(async ({ podcastId, characters }) =>
      ok(
        await apiPut(`/api/podcasts/${encode(podcastId)}/characters`, {
          characters,
        }),
      ),
    ),
  );

  server.registerTool(
    "update_podcast_characters",
    {
      description:
        "Patch character voices/names/definitions without clearing the script. Pass character ids from get_podcast. Audio generation uses these latest voice picks.",
      inputSchema: {
        podcastId: z.string().min(1),
        updates: z
          .array(
            z.object({
              id: z.string().min(1),
              name: z.string().trim().min(1).max(80).optional(),
              gender: podcastGender.optional(),
              definition: z.string().trim().max(1000).optional(),
              providerId: z.string().optional(),
              voiceId: z.string().optional(),
              modelId: z.string().nullable().optional(),
            }),
          )
          .min(1),
      },
    },
    guard(async ({ podcastId, updates }) =>
      ok(
        await apiPatch(`/api/podcasts/${encode(podcastId)}/characters`, {
          updates,
        }),
      ),
    ),
  );

  server.registerTool(
    "ai_generate_podcast_script",
    {
      description:
        "AI-generate a humanised multi-speaker podcast script for an existing cast. Requires an AI key in Settings. Characters must already exist (create_podcast / replace_podcast_characters).",
      inputSchema: {
        podcastId: z.string().min(1),
        providerId: z.enum(["gemini", "openai"]),
        modelId: z.string().optional(),
        brief: z.string().trim().min(3).max(8000),
        length: podcastLength.optional(),
        updateMeta: z
          .boolean()
          .optional()
          .describe("When true (default), apply plan title/description to the podcast."),
      },
    },
    guard(async ({ podcastId, ...body }) =>
      ok(await apiPost(`/api/podcasts/${encode(podcastId)}/ai`, body)),
    ),
  );

  server.registerTool(
    "import_podcast_script",
    {
      description:
        "Replace all dialogue turns from a structured plan JSON. characterId on each turn must match Setup character keys. Prefer ai_generate_podcast_script for AI drafts.",
      inputSchema: {
        podcastId: z.string().min(1),
        plan: z.object({
          title: z.string().trim().min(1).max(120).optional(),
          description: z.string().trim().max(2000).optional(),
          characters: z
            .array(
              z.object({
                id: z.string().trim().min(1).max(40),
                name: z.string().trim().min(1).max(80),
                gender: podcastGender.optional(),
              }),
            )
            .min(2)
            .max(4),
          turns: z
            .array(
              z.object({
                characterId: z.string().trim().min(1).max(40),
                text: z.string().trim().min(1).max(4000),
              }),
            )
            .min(2)
            .max(120),
        }),
        updateMeta: z.boolean().optional(),
      },
    },
    guard(async ({ podcastId, plan, updateMeta }) =>
      ok(
        await apiPost(`/api/podcasts/${encode(podcastId)}/turns`, {
          plan,
          updateMeta,
        }),
      ),
    ),
  );

  server.registerTool(
    "insert_podcast_turn",
    {
      description:
        "Insert one dialogue line. characterId is the PodcastCharacter.id from get_podcast (not the key). Omit afterTurnId to append; set afterTurnId to insert below that turn.",
      inputSchema: {
        podcastId: z.string().min(1),
        characterId: z.string().min(1),
        text: z.string().trim().min(1).max(4000),
        afterTurnId: z.string().min(1).nullable().optional(),
      },
    },
    guard(async ({ podcastId, ...body }) =>
      ok(await apiPost(`/api/podcasts/${encode(podcastId)}/turns`, body)),
    ),
  );

  server.registerTool(
    "update_podcast_turn",
    {
      description: "Update the spoken text of one dialogue turn.",
      inputSchema: {
        podcastId: z.string().min(1).describe("Podcast id (for routing consistency)."),
        turnId: z.string().min(1),
        text: z.string().trim().min(1).max(4000),
      },
    },
    guard(async ({ podcastId, turnId, text }) =>
      ok(
        await apiPatch(`/api/podcasts/${encode(podcastId)}/turns`, {
          turnId,
          text,
        }),
      ),
    ),
  );

  server.registerTool(
    "list_podcast_takes",
    {
      description: "List generated audio takes for a podcast (newest first).",
      inputSchema: { podcastId: z.string().min(1) },
    },
    guard(async ({ podcastId }) =>
      ok(await apiGet(`/api/podcasts/${encode(podcastId)}/takes`)),
    ),
  );

  server.registerTool(
    "create_podcast_take",
    {
      description:
        "Start multi-speaker podcast audio generation (per-turn TTS by character voice, then stitch in order). Requires voices on all characters. Returns jobId — poll get_podcast_take_job until done.",
      inputSchema: { podcastId: z.string().min(1) },
    },
    guard(async ({ podcastId }) =>
      ok(await apiPost(`/api/podcasts/${encode(podcastId)}/takes`, {})),
    ),
  );

  server.registerTool(
    "get_podcast_take_job",
    {
      description:
        "Poll a create_podcast_take job. status flows queued → synthesizing → stitching → done|error. When done, podcastTake includes audioUrl and voice snapshot.",
      inputSchema: {
        podcastId: z.string().min(1),
        jobId: z.string().min(1),
      },
    },
    guard(async ({ podcastId, jobId }) =>
      ok(
        await apiGet(
          `/api/podcasts/${encode(podcastId)}/takes/${encode(jobId)}`,
        ),
      ),
    ),
  );

  server.registerTool(
    "download_podcast_take",
    {
      description:
        "Return an absolute WAV URL for a finished podcast take. Pass audioUrl from get_podcast / list_podcast_takes / get_podcast_take_job.",
      inputSchema: {
        audioUrl: z
          .string()
          .min(1)
          .describe("Relative /media/... path or absolute URL from the take."),
      },
    },
    guard(async ({ audioUrl }) =>
      ok({ downloadUrl: absoluteUrl(audioUrl) }),
    ),
  );
}
