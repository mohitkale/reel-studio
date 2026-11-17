// @vitest-environment node
import { expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

vi.mock("../../mcp/src/client.js", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiGetText: vi.fn(),
  apiPut: vi.fn(),
  absoluteUrl: vi.fn(),
  encode: encodeURIComponent,
  BASE_URL: "http://studio",
}));
import {
  registerStoryboardPrompts,
  registerStoryboardResources,
  SERVER_INSTRUCTIONS,
} from "../../mcp/src/storyboard-resources";

function collect() {
  const resources = new Map<
    string,
    () => Promise<{ contents: { text: string }[] }>
  >();
  const prompts = new Map<
    string,
    (args: Record<string, string>) => {
      messages: { content: { text: string } }[];
    }
  >();
  const server = {
    registerResource: (_n: string, uri: string, _c: unknown, read: never) =>
      resources.set(uri, () => (read as (u: URL) => never)(new URL(uri))),
    registerPrompt: (name: string, _c: unknown, run: never) =>
      prompts.set(name, run),
  } as unknown as McpServer;
  registerStoryboardResources(server);
  registerStoryboardPrompts(server);
  return { resources, prompts };
}

it("lists the four storyboard resources and serves real content", async () => {
  const { resources } = collect();
  expect([...resources.keys()].sort()).toEqual([
    "reel://options",
    "reel://storyboard/examples",
    "reel://storyboard/guide",
    "reel://storyboard/schema",
  ]);
  const schema = JSON.parse(
    (await resources.get("reel://storyboard/schema")!()).contents[0]!.text,
  );
  expect(JSON.stringify(schema)).toContain('"scenes"');
  const guide = (await resources.get("reel://storyboard/guide")!()).contents[0]!
    .text;
  expect(guide.length).toBeGreaterThan(500);
  const examples = JSON.parse(
    (await resources.get("reel://storyboard/examples")!()).contents[0]!.text,
  );
  expect(Object.keys(examples)).toEqual([
    "explainer",
    "listicle",
    "myth-vs-fact",
  ]);
  const options = JSON.parse(
    (await resources.get("reel://options")!()).contents[0]!.text,
  );
  expect(options.themes).toHaveLength(10);
});

it("offers the five prompts, each pointing at the guide and ending in create_video", () => {
  const { prompts } = collect();
  expect([...prompts.keys()].sort()).toEqual([
    "make-explainer",
    "make-podcast",
    "make-short",
    "repurpose",
    "series",
  ]);
  const short = prompts.get("make-short")!({
    topic: "why the sky is blue",
    seconds: "45",
  });
  const text = short.messages[0]!.content.text;
  expect(text).toContain("reel://storyboard/guide");
  expect(text).toContain("why the sky is blue");
  expect(text).toContain("45 seconds");
  expect(text).toContain("storyboard.sources");
  expect(text).toContain("create_video");
  expect(
    prompts.get("series")!({ name: "Weekly", topics: "a, b" }).messages[0]!
      .content.text,
  ).toContain('"series": "Weekly"');
});

it("the server instructions are four sentences about the workflow", () => {
  expect(SERVER_INSTRUCTIONS.split(". ").length).toBe(4);
  expect(SERVER_INSTRUCTIONS).toContain("create_video");
});
