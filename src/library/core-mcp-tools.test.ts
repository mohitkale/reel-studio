// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../../mcp/src/client.js", () => ({
  apiGet: mocks.get,
  apiPost: mocks.post,
  apiPatch: vi.fn(),
  apiGetText: vi.fn(),
  apiPut: vi.fn(),
  absoluteUrl: (p: string) => `http://studio${p}`,
  encode: encodeURIComponent,
  BASE_URL: "http://studio",
}));
import { registerCoreTools, waitForJob } from "../../mcp/src/core-tools";
import { registerTools } from "../../mcp/src/tools";

type Handler = (args: unknown) => Promise<{
  isError?: boolean;
  content: { text: string }[];
}>;

function register(fn: (server: McpServer) => void) {
  const tools = new Map<
    string,
    {
      config: { description: string; inputSchema: z.ZodRawShape };
      run: Handler;
    }
  >();
  fn({
    registerTool: (name: string, config: never, run: Handler) =>
      tools.set(name, { config, run }),
  } as unknown as McpServer);
  return tools;
}

beforeEach(() => {
  mocks.get.mockReset();
  mocks.post.mockReset();
});

it("registers the core tools with short definitions", () => {
  const tools = register(registerCoreTools);
  expect([...tools.keys()].sort()).toEqual([
    "create_video",
    "get_job",
    "list_options",
    "list_videos",
    "open_studio",
  ]);
  const size = [...tools.entries()].reduce(
    (sum, [name, { config }]) =>
      sum +
      name.length +
      config.description.length +
      JSON.stringify(z.toJSONSchema(z.object(config.inputSchema))).length,
    0,
  );
  // About four characters per token; the roadmap budget for all eight is 3000.
  expect(size / 4).toBeLessThan(1500);
});

it("create_video queues, waits and returns the finished video link", async () => {
  mocks.post.mockResolvedValue({ jobId: "j1", projectId: "p1", fixes: [] });
  mocks.get.mockImplementation(async (path: string) => {
    if (path.endsWith("/artifacts/o1"))
      return { artifact: { downloadUrl: "/media/v.mp4" } };
    return {
      job: {
        state: "succeeded",
        progress: 1,
        outputs: [{ id: "o1", kind: "video" }],
      },
    };
  });
  const run = register(registerCoreTools).get("create_video")!.run;
  const result = await run({ storyboard: { version: 1 }, quality: "draft" });
  expect(mocks.post).toHaveBeenCalledWith("/api/storyboards?quality=draft", {
    version: 1,
  });
  expect(JSON.parse(result.content[0]!.text)).toMatchObject({
    projectId: "p1",
    state: "succeeded",
    videoUrl: "http://studio/media/v.mp4",
  });
});

it("create_video can return the job id straight away", async () => {
  mocks.post.mockResolvedValue({ jobId: "j2", projectId: "p2" });
  const run = register(registerCoreTools).get("create_video")!.run;
  const result = await run({ storyboard: {}, wait: false });
  expect(JSON.parse(result.content[0]!.text)).toMatchObject({
    jobId: "j2",
    state: "queued",
  });
  expect(mocks.get).not.toHaveBeenCalled();
});

it("surfaces the engine's storyboard errors as a tool error", async () => {
  mocks.post.mockRejectedValue(new Error("scenes[0].type: Unknown scene type"));
  const run = register(registerCoreTools).get("create_video")!.run;
  const result = await run({ storyboard: {} });
  expect(result.isError).toBe(true);
  expect(result.content[0]!.text).toContain("Unknown scene type");
});

it("waitForJob stops at the wait limit with the latest state", async () => {
  mocks.get.mockResolvedValue({ job: { state: "running", progress: 0.4 } });
  const view = await waitForJob("j3", 0, 1);
  expect(view).toMatchObject({ state: "running", progress: 40 });
});

it("list_options is one compact answer", async () => {
  const run = register(registerCoreTools).get("list_options")!.run;
  const options = JSON.parse((await run({})).content[0]!.text);
  expect(options.themes.length).toBe(10);
  expect(options.sceneTypes).toContain("steps");
  expect(options.formats).toEqual(["9:16", "16:9", "1:1"]);
});

it("REEL_STUDIO_MCP_TOOLS=core hides the advanced tools; the default keeps them", () => {
  const all = register(registerTools);
  expect(all.size).toBeGreaterThan(80);
  vi.stubEnv("REEL_STUDIO_MCP_TOOLS", "core");
  const core = register(registerTools);
  vi.unstubAllEnvs();
  expect(core.size).toBe(5);
  expect(all.has("create_video")).toBe(true);
});
