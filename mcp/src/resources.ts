import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { apiGet } from "./client.js";

/**
 * Read-only resources that teach an agent how to author valid scenes, mirroring
 * the rules the in-app AI director follows (src/providers/ai/prompt.ts) and the
 * Zod schemas the REST API enforces.
 */

const AUTHORING_RULES = `# Reel Studio — scene authoring rules

A reel is a vertical (or square/landscape) short video made of ordered **scenes**.
Each scene has on-screen **text**, optional **spokenText** for voiceover, a
**templateId**, optional **emphasis** phrases, an optional **visual**, and an
optional photo **background**.

## Text vs spokenText
- \`text\` — short on-screen copy (~14–18 words). Always required for the visual.
- \`spokenText\` — optional longer narration. When null/omitted, TTS uses \`text\`.
- With AI \`scriptStyle: "short"\`: only \`text\` (voice inherits).
- With AI \`scriptStyle: "detailed"\`: short \`text\` + longer \`spokenText\` (~2–3×, ~30–55 words).
- Plain conversational English. No em-dashes. No corporate filler.
- Scene 1 must be a scroll-stopping hook (surprising fact, bold claim, problem, or question).
- Every scene should create a curiosity gap pulling the viewer to the next.
- The final scene should include a clear call to action.

## templateId (pick precisely)
- **stat-reveal** — any scene with a number/stat/metric. REQUIRED: set \`visual\` to the number string (e.g. "73%", "10x", "$2B"). Keep \`visual\` SHORT (under ~20 characters).
- **icon-grid** — any scene listing 3+ tips/steps/items. REQUIRED: set \`visual\` to a bullet emoji (e.g. "✓", "→", "⚡") and put items in \`items\`.
- **emoji-punch** — punchline, emotional beat, or reveal. REQUIRED: set \`visual\` to a fitting emoji (e.g. "🔥", "😱", "💡").
- **quote-card** — quotes/testimonials. \`visual\` = speaker name (optional).
- **lottie** — process steps, how-it-works, abstract concept reveals.
- **three** — the single most powerful hero moment; use EXACTLY once per video.
- **kinetic** — text-only scenes when nothing above fits. Limit to ~40% of scenes; never more than 2 in a row.
- DIVERSITY: a video with 5+ scenes should use at least 4 different templates.

## emphasis
- 1–3 short phrases that appear **verbatim** inside that scene's \`text\` or \`spokenText\` (used for on-screen highlight).

## background (optional)
- \`{ type: "image" | "video", url, effect? }\`. Effect is a pan/zoom: ken-burns, pan-left, pan-right, pan-up, pan-down.
- Use a background on roughly 40–70% of scenes; clean text beats (most stat/icon/quote/emoji) look best without one.

## mood & musicMood (optional, recommended)
- \`mood\` — one of energetic, calm, dramatic, playful, inspiring, tech, nature. Drives a dynamic, on-brand animated background for scenes with no \`background\` image (instead of a plain gradient). Vary it to match each scene's emotional beat.
- \`musicMood\` — 1–3 words describing the ideal background music vibe (e.g. "uplifting lo-fi", "tense cinematic"), used to auto-suggest a matching track.

## Style + Energy (whole reel)
- Set via \`ai_create_project\` (\`styleId\` / \`energy\`) or \`update_script\` after create.
- Style: \`bold-hook\` | \`clean-story\` | \`teach-me\` | \`soft-brand\` (default brand kit is Coral Harbor).
- Energy: \`calm\` | \`normal\` | \`high\` — controls motion intensity.

## Voice modes
- \`oneshot\` (default): \`create_voice_take\` → poll \`get_voice_job\`.
- \`per_scene\`: \`update_script\` with \`voiceMode: "per_scene"\` → \`generate_scene_clips\` → poll \`get_scene_clips_job\` → optional \`assemble_scene_clips\` / \`update_scene.selectedVoiceClipId\`.
- TTS always uses \`spokenText ?? text\` per scene.

## Script style
- \`ai_create_project\` / \`ai_generate_scenes\` accept \`scriptStyle\`: "short" or "detailed" (see Text vs spokenText above).

## Building large storyboards incrementally
- Models and single AI calls cap out around 20 scenes. To go bigger or stay current:
  1. \`ai_create_project\` (or \`create_project\`) for the first chunk.
  2. \`ai_generate_scenes\` with mode "append" — or \`add_scene\` + \`update_scene\` — to extend in parts. Existing scenes are never touched by append.
  3. Use web search (your own tools) to populate up-to-date facts the model may not know, then write them into scenes.
- \`reorder_scenes\` re-sequences; nothing is ever deleted via MCP.

## Audio podcasts (separate from video projects)
- Tools: \`list_podcasts\`, \`get_podcast\`, \`create_podcast\`, \`update_podcast\`,
  \`replace_podcast_characters\` (clears turns), \`update_podcast_characters\` (voices),
  \`ai_generate_podcast_script\`, \`import_podcast_script\`, \`insert_podcast_turn\`,
  \`update_podcast_turn\`, \`create_podcast_take\` → \`get_podcast_take_job\`,
  \`list_podcast_takes\`, \`download_podcast_take\`.
- Character **definition** shapes AI writing only; **voice** (\`providerId\`/\`voiceId\`)
  is what TTS uses. Always set voices before \`create_podcast_take\`.
- Never delete podcasts, turns, or takes via MCP (web UI only).

## Rendering
- \`request_render\` only QUEUES a render for human approval; it never starts automatically.
- The user approves in Reel Studio → Renders. Then poll \`get_render\`; when "done", call \`download_render\`.
`;

const PODCAST_AUTHORING = `# Reel Studio — podcast authoring rules

Audio-only multi-speaker episodes (not video projects).

## Cast
- 2–4 characters with stable \`key\` (JSON id), display \`name\`, \`gender\`, optional \`definition\`.
- \`definition\` = personality for AI scripts only.
- Assign server TTS voices via \`update_podcast_characters\` (Cartesia / ElevenLabs / VoiceForge / Kokoro Server as configured).

## Script
- Prefer \`ai_generate_podcast_script\` with a brief + length short|long.
- Or \`import_podcast_script\` with turns whose \`characterId\` matches Setup keys.
- Edit with \`insert_podcast_turn\` / \`update_podcast_turn\`. Deleting lines is web-only.

## Audio
- \`create_podcast_take\` synthesizes each turn with that character's voice, then stitches in order.
- Poll \`get_podcast_take_job\` until done; use \`download_podcast_take\` with the take's \`audioUrl\`.
`;

const SCENE_SCHEMA = {
  templateIds: [
    "kinetic",
    "lottie",
    "three",
    "stat-reveal",
    "icon-grid",
    "quote-card",
    "emoji-punch",
  ],
  scene: {
    text: "string, <= 2000 chars (on-screen copy, ~14-18 words)",
    spokenText:
      "string <= 4000 chars, or null to clear — longer voiceover; TTS uses spokenText ?? text",
    templateId: "one of templateIds",
    emphasis: "string[] — phrases appearing verbatim in text or spokenText",
    visual: "string <= 2048 chars, or null to clear (emoji/stat/label; keep short)",
    background:
      "{ type: 'image'|'video', url: string<=2048, effect?: 'ken-burns'|'pan-left'|'pan-right'|'pan-up'|'pan-down', muted?: boolean } or null",
    items: "string[] (<=24, each <=280) for list/checklist templates, or null",
    mood: "one of energetic|calm|dramatic|playful|inspiring|tech|nature, or null — drives the dynamic background when there's no photo background",
    musicMood: "string <= 60 chars (e.g. 'uplifting lo-fi'), or null — music vibe hint for auto suggestions",
    selectedVoiceClipId: "string or null — active SceneVoiceClip in per_scene mode",
  },
  script: {
    styleId: ["bold-hook", "clean-story", "teach-me", "soft-brand"],
    energy: ["calm", "normal", "high"],
    voiceMode: ["oneshot", "per_scene"],
  },
  orientation: ["portrait", "landscape", "square"],
  scriptStyle: ["short", "detailed"],
};

const TEMPLATE_CATALOG = [
  { id: "kinetic", purpose: "Punchy headline text reveal — the default workhorse." },
  { id: "lottie", purpose: "Explainer / process step with a vector animation." },
  { id: "three", purpose: "Bold 3D hero moment (use at most once)." },
  { id: "stat-reveal", purpose: "Big stat/number reveal; visual = the number." },
  { id: "icon-grid", purpose: "Checklist or tips; visual = a bullet emoji; use items." },
  { id: "quote-card", purpose: "Quote or testimonial; visual = optional attribution." },
  { id: "emoji-punch", purpose: "Single big emoji punchline; visual = the emoji." },
];

const PODCAST_SCHEMA = {
  length: ["short", "long"],
  gender: ["male", "female", "neutral"],
  character: {
    key: "stable JSON id used in dialogue (e.g. host)",
    name: "display name",
    gender: "male|female|neutral",
    definition: "AI script personality only (not TTS)",
    providerId: "TTS provider id",
    voiceId: "provider voice id",
    modelId: "optional model id or null",
  },
  turn: {
    characterId:
      "For import_podcast_script: character key. For insert_podcast_turn: PodcastCharacter.id",
    text: "spoken dialogue, humanised wording (no stage directions)",
  },
};

export function registerResources(server: McpServer): void {
  server.registerResource(
    "authoring-rules",
    "reel://authoring/rules",
    {
      title: "Scene authoring rules",
      description:
        "How to write valid, high-retention scenes and build storyboards incrementally via MCP.",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: AUTHORING_RULES }],
    }),
  );

  server.registerResource(
    "podcast-authoring-rules",
    "reel://authoring/podcast",
    {
      title: "Podcast authoring rules",
      description:
        "How to create multi-speaker audio podcasts via MCP (cast, script, takes).",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [
        { uri: uri.href, mimeType: "text/markdown", text: PODCAST_AUTHORING },
      ],
    }),
  );

  server.registerResource(
    "scene-schema",
    "reel://schema/scene",
    {
      title: "Scene schema",
      description: "Field types and enums the API enforces for scenes.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(SCENE_SCHEMA, null, 2),
        },
      ],
    }),
  );

  server.registerResource(
    "podcast-schema",
    "reel://schema/podcast",
    {
      title: "Podcast schema",
      description: "Field types for podcast cast, turns, and length.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(PODCAST_SCHEMA, null, 2),
        },
      ],
    }),
  );

  server.registerResource(
    "template-catalog",
    "reel://catalog/templates",
    {
      title: "Template catalog",
      description: "The seven scene templates and what each is for.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(TEMPLATE_CATALOG, null, 2),
        },
      ],
    }),
  );

  server.registerResource(
    "voice-catalog",
    "reel://catalog/voices",
    {
      title: "Voice providers",
      description:
        "Live list of voice providers and whether each is configured (use list_voices for individual voices).",
      mimeType: "application/json",
    },
    async (uri) => {
      let body: unknown;
      try {
        body = await apiGet("/api/providers");
      } catch (e) {
        body = { error: e instanceof Error ? e.message : String(e) };
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(body, null, 2),
          },
        ],
      };
    },
  );
}
