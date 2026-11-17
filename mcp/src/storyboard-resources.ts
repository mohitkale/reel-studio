/**
 * Storyboard resources and prompts for agents (roadmap M4). The agent is the
 * storyboard writer on the MCP path, so it gets the same schema, craft guide
 * and examples the built-in writer uses, plus ready-made prompts that appear as
 * slash commands in clients that support them.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { RECOMMENDED_KOKORO_VOICES } from "@/providers/voice/kokoro";
import { MUSIC_LIBRARY } from "@/lib/music-library";
import { SCENE_TYPES } from "@/storyboard";
import { THEMES } from "@/video/themes";

const root = path.resolve(import.meta.dirname, "..", "..");
const read = (...parts: string[]) =>
  readFileSync(path.join(root, ...parts), "utf8");

/** Three golden storyboards that show the craft: a short, a list, a myth check. */
const EXAMPLE_NAMES = ["explainer", "listicle", "myth-vs-fact"] as const;

export const SERVER_INSTRUCTIONS =
  "Reel Studio turns a Storyboard v1 JSON file into a finished video; you write only the JSON. " +
  "Read reel://storyboard/guide and reel://storyboard/schema, then write the storyboard and call create_video. " +
  "When the video is ready call review_video if it is available, and revise once if it points out a problem. " +
  "Voice, scenes, captions, music and rendering all run locally and deterministically.";

export function registerStoryboardResources(server: McpServer): void {
  const add = (
    name: string,
    uri: string,
    title: string,
    description: string,
    mimeType: string,
    text: () => string,
  ) =>
    server.registerResource(
      name,
      uri,
      { title, description, mimeType },
      async (url) => ({
        contents: [{ uri: url.href, mimeType, text: text() }],
      }),
    );

  add(
    "storyboard-schema",
    "reel://storyboard/schema",
    "Storyboard v1 JSON Schema",
    "The exact shape of the storyboard that create_video accepts.",
    "application/json",
    () => read("schemas", "storyboard.v1.json"),
  );
  add(
    "storyboard-guide",
    "reel://storyboard/guide",
    "Storyboard writing guide",
    "How to write a storyboard that makes a good video: hook, pacing, scene types, sources.",
    "text/markdown",
    () => read("docs", "prompts", "storyboard-writer.md"),
  );
  add(
    "storyboard-examples",
    "reel://storyboard/examples",
    "Example storyboards",
    "Three finished storyboards (explainer, list, myth check) to copy the style from.",
    "application/json",
    () =>
      JSON.stringify(
        Object.fromEntries(
          EXAMPLE_NAMES.map((name) => [
            name,
            JSON.parse(read("examples", "storyboards", `${name}.json`)),
          ]),
        ),
      ),
  );
  add(
    "options",
    "reel://options",
    "Themes, scene types, voices and music",
    "Everything a storyboard can choose from.",
    "application/json",
    () =>
      JSON.stringify({
        themes: THEMES.map((t) => ({ id: t.id, use: t.description })),
        sceneTypes: SCENE_TYPES,
        formats: ["9:16", "16:9", "1:1"],
        voices: RECOMMENDED_KOKORO_VOICES,
        music: MUSIC_LIBRARY.map((track) => track.id),
      }),
  );
}

const RESEARCH =
  "If the topic is time-sensitive, research it first with your own web tools and put the sources in storyboard.sources.";
const FINISH =
  "Then call create_video with the storyboard. When it finishes, call review_video if it is available and revise once if it names a problem. Give me the video link.";

function userText(text: string) {
  return {
    messages: [
      { role: "user" as const, content: { type: "text" as const, text } },
    ],
  };
}

export function registerStoryboardPrompts(server: McpServer): void {
  const lead =
    "Read the resources reel://storyboard/guide, reel://storyboard/schema and reel://storyboard/examples first.";
  server.registerPrompt(
    "make-short",
    {
      title: "Make a short",
      description: "A vertical short video about a topic.",
      argsSchema: { topic: z.string(), seconds: z.string().optional() },
    },
    ({ topic, seconds }) =>
      userText(
        `${lead} Write a Storyboard v1 for a vertical (9:16) short video of about ${seconds ?? "30"} seconds about: ${topic}. ${RESEARCH} ${FINISH}`,
      ),
  );
  server.registerPrompt(
    "make-explainer",
    {
      title: "Make an explainer",
      description: "A longer explainer video about a topic.",
      argsSchema: { topic: z.string(), format: z.string().optional() },
    },
    ({ topic, format }) =>
      userText(
        `${lead} Write a Storyboard v1 for an explainer video (${format ?? "16:9"}, about 60 to 90 seconds) about: ${topic}. ${RESEARCH} ${FINISH}`,
      ),
  );
  server.registerPrompt(
    "make-podcast",
    {
      title: "Make a podcast episode",
      description: "A short audio podcast with hosts.",
      argsSchema: { topic: z.string(), hosts: z.string().optional() },
    },
    ({ topic, hosts }) =>
      userText(
        `Read reel://authoring/podcast first. Plan a short podcast episode with ${hosts ?? "two hosts"} about: ${topic}. ${RESEARCH} Create it with the podcast tools (create_podcast, import_podcast_script, create_podcast_take), which need REEL_STUDIO_MCP_TOOLS to include them (the default does). Give me the episode link.`,
      ),
  );
  server.registerPrompt(
    "repurpose",
    {
      title: "Repurpose into a video",
      description: "Turn a URL or pasted text into a video.",
      argsSchema: { source: z.string() },
    },
    ({ source }) =>
      userText(
        `${lead} Read this source (fetch it with your own web tools if it is a URL) and write a Storyboard v1 that retells it as a short video, keeping the facts accurate and listing it in storyboard.sources: ${source}. ${FINISH}`,
      ),
  );
  server.registerPrompt(
    "series",
    {
      title: "Make a series",
      description: "One video per topic, with one shared look.",
      argsSchema: { name: z.string(), topics: z.string() },
    },
    ({ name, topics }) =>
      userText(
        `${lead} Make one video per topic in this list, all with the same storyboard "series": "${name}" so they share a look. Topics: ${topics}. ${RESEARCH} For each topic write a storyboard and call create_video, then list the links.`,
      ),
  );
}
