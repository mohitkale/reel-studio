import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { apiGet } from "./client.js";

/**
 * Read-only resources that teach an agent how to author valid scenes, mirroring
 * the rules the in-app AI director follows (src/providers/ai/prompt.ts) and the
 * Zod schemas the REST API enforces.
 */

const AUTHORING_RULES = `# Reel Studio — scene authoring rules

A reel is a vertical (or square/landscape) short video made of ordered **scenes**.
Each scene has spoken **text**, a **templateId**, optional **emphasis** phrases,
an optional **visual**, and an optional photo **background**.

## Text
- Plain, conversational English. No em-dashes. No corporate filler.
- One or two short spoken sentences per scene — about **18 words max**.
- Scene 1 must be a scroll-stopping hook (surprising fact, bold claim, problem, or question).
- Every scene should create a curiosity gap pulling the viewer to the next.
- The final scene should include a clear call to action.

## templateId (pick precisely)
- **stat-reveal** — any scene with a number/stat/metric. REQUIRED: set \`visual\` to the number string (e.g. "73%", "10x", "$2B").
- **icon-grid** — any scene listing 3+ tips/steps/items. REQUIRED: set \`visual\` to a bullet emoji (e.g. "✓", "→", "⚡") and put items in \`items\`.
- **emoji-punch** — punchline, emotional beat, or reveal. REQUIRED: set \`visual\` to a fitting emoji (e.g. "🔥", "😱", "💡").
- **quote-card** — quotes/testimonials. \`visual\` = speaker name (optional).
- **lottie** — process steps, how-it-works, abstract concept reveals.
- **three** — the single most powerful hero moment; use EXACTLY once per video.
- **kinetic** — text-only scenes when nothing above fits. Limit to ~40% of scenes; never more than 2 in a row.
- DIVERSITY: a video with 5+ scenes should use at least 4 different templates.

## emphasis
- 1–3 short phrases that appear **verbatim** inside that scene's text (used for on-screen highlight).

## background (optional)
- \`{ type: "image" | "video", url, effect? }\`. Effect is a pan/zoom: ken-burns, pan-left, pan-right, pan-up, pan-down.
- Use a background on roughly 40–70% of scenes; clean text beats (most stat/icon/quote/emoji) look best without one.

## Building large storyboards incrementally
- Models and single AI calls cap out around 20 scenes. To go bigger or stay current:
  1. \`ai_create_project\` (or \`create_project\`) for the first chunk.
  2. \`ai_generate_scenes\` with mode "append" — or \`add_scene\` + \`update_scene\` — to extend in parts. Existing scenes are never touched by append.
  3. Use web search (your own tools) to populate up-to-date facts the model may not know, then write them into scenes.
- \`reorder_scenes\` re-sequences; nothing is ever deleted via MCP.

## Rendering
- \`request_render\` only QUEUES a render for human approval; it never starts automatically.
- The user approves in Reel Studio → Renders. Then poll \`get_render\`; when "done", call \`download_render\`.
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
    text: "string, <= 2000 chars (spoken narration, ~18 words)",
    templateId: "one of templateIds",
    emphasis: "string[] — phrases appearing verbatim in text",
    visual: "string <= 2048 chars, or null to clear (emoji/stat/label)",
    background:
      "{ type: 'image'|'video', url: string<=2048, effect?: 'ken-burns'|'pan-left'|'pan-right'|'pan-up'|'pan-down', muted?: boolean } or null",
    items: "string[] (<=24, each <=280) for list/checklist templates, or null",
  },
  orientation: ["portrait", "landscape", "square"],
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
