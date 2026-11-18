// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  binary: vi.fn(),
}));
vi.mock("../../mcp/src/client.js", () => ({
  apiGet: mocks.get,
  apiPost: mocks.post,
  apiPatch: vi.fn(),
  apiGetText: vi.fn(),
  apiGetBinary: mocks.binary,
  apiPut: vi.fn(),
  absoluteUrl: (p: string) => `http://studio${p}`,
  encode: encodeURIComponent,
  BASE_URL: "http://studio",
}));
import {
  explainFailure,
  registerCoreTools,
  waitForJob,
} from "../../mcp/src/core-tools";
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
  mocks.binary.mockReset();
});

it("registers the eight core tools with short definitions", () => {
  const tools = register(registerCoreTools);
  expect([...tools.keys()].sort()).toEqual([
    "create_podcast",
    "create_video",
    "get_job",
    "list_options",
    "list_videos",
    "open_studio",
    "review_video",
    "revise_video",
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
  expect(size / 4).toBeLessThan(2500);
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
    thumbnailUrl:
      "http://studio/api/production-jobs/j1/thumbnail?size=landscape",
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

it("the default toolset is the core tools; REEL_STUDIO_MCP_TOOLS=all adds the rest", () => {
  const byDefault = register((server) => registerTools(server, undefined));
  expect(byDefault.size).toBe(8);
  const core = register((server) => registerTools(server, "core"));
  expect(core.size).toBe(8);
  const all = register((server) => registerTools(server, "all"));
  expect(all.size).toBeGreaterThan(80);
  expect(all.has("create_video")).toBe(true);
});

const succeededJob = {
  job: {
    state: "succeeded",
    progress: 1,
    outputs: [
      {
        id: "o1",
        kind: "video",
        metadata: {
          duration: 21.04,
          width: 1080,
          height: 1920,
          bytes: 2_000_000,
          contactSheet: "renders/render-x.contact-sheet.jpg",
        },
      },
    ],
  },
};

it("a finished job returns the file's facts and the contact sheet as an image", async () => {
  mocks.post.mockResolvedValue({ jobId: "j1", projectId: "p1" });
  mocks.get.mockImplementation(async (path: string) =>
    path.endsWith("/artifacts/o1")
      ? { artifact: { downloadUrl: "/media/renders/render-x.mp4" } }
      : succeededJob,
  );
  mocks.binary.mockResolvedValue(Buffer.from("jpegbytes"));
  const run = register(registerCoreTools).get("create_video")!.run;
  const result = await run({ storyboard: {} });
  const body = JSON.parse(result.content[0]!.text);
  expect(body).toMatchObject({
    state: "succeeded",
    durationSeconds: 21,
    width: 1080,
    height: 1920,
    bytes: 2_000_000,
    studioUrl: "http://studio/results/j1",
  });
  expect(result.content[1]).toEqual({
    type: "image",
    data: Buffer.from("jpegbytes").toString("base64"),
    mimeType: "image/jpeg",
  });
  expect(mocks.binary).toHaveBeenCalledWith(
    "/media/renders/render-x.contact-sheet.jpg",
  );
});

it("leaves the image out when it is over 1 MB or missing", async () => {
  mocks.get.mockImplementation(async (path: string) =>
    path.endsWith("/artifacts/o1")
      ? { artifact: { downloadUrl: "/media/renders/render-x.mp4" } }
      : succeededJob,
  );
  mocks.binary.mockResolvedValue(Buffer.alloc(1_100_000));
  const run = register(registerCoreTools).get("get_job")!.run;
  expect((await run({ jobId: "j1" })).content).toHaveLength(1);
  mocks.binary.mockResolvedValue(null);
  expect((await run({ jobId: "j1" })).content).toHaveLength(1);
});

it("sends a progress notification per poll when the client asks for them", async () => {
  mocks.post.mockResolvedValue({ jobId: "j1", projectId: "p1" });
  let polls = 0;
  mocks.get.mockImplementation(async (path: string) => {
    if (path.endsWith("/artifacts/o1"))
      return { artifact: { downloadUrl: "/media/renders/render-x.mp4" } };
    polls += 1;
    return polls < 2
      ? {
          job: {
            state: "running",
            progress: 0.5,
            steps: [{ key: "render_export", state: "running" }],
          },
        }
      : succeededJob;
  });
  mocks.binary.mockResolvedValue(null);
  const sent: unknown[] = [];
  const run = register(registerCoreTools).get("create_video")!.run as (
    args: unknown,
    extra: unknown,
  ) => Promise<unknown>;
  vi.useFakeTimers();
  const pending = run(
    { storyboard: {} },
    {
      _meta: { progressToken: "t1" },
      sendNotification: async (n: unknown) => void sent.push(n),
    },
  );
  await vi.advanceTimersByTimeAsync(3500);
  await pending;
  vi.useRealTimers();
  expect(sent[0]).toMatchObject({
    method: "notifications/progress",
    params: {
      progressToken: "t1",
      progress: 50,
      total: 100,
      message: "rendering",
    },
  });
});

describe("explainFailure", () => {
  it("names the stage, the cause and a specific fix for every kind of failure", () => {
    const cases: Array<[string, string, RegExp]> = [
      ["synthesize_audio", "Kokoro model files not found", /voice:download/],
      ["render_export", "spawn ffmpeg ENOENT", /doctor --fix/],
      ["render_export", "Could not find Chrome", /Chrome/],
      ["validate", "scenes[0].type: Unknown", /storyboard is not valid/],
      ["time_content", "Requested duration 900s exceeds", /too long/],
      ["resolve_media", "stock provider timeout", /Stock media/],
      ["synthesize_audio", "provider returned 500", /voice\.enabled/],
      ["verify_artifacts", "weird", /checking the file/],
    ];
    for (const [stage, error, fix] of cases) {
      const out = explainFailure(stage, error);
      expect(out.stage).toBe(stage);
      expect(out.cause).toContain(error.slice(0, 10));
      expect(out.fix).toMatch(fix);
    }
  });

  it("is attached to a failed job", async () => {
    mocks.get.mockResolvedValue({
      job: {
        state: "failed",
        steps: [
          {
            key: "synthesize_audio",
            state: "failed",
            error: "Kokoro model files not found",
          },
        ],
      },
    });
    const run = register(registerCoreTools).get("get_job")!.run;
    const body = JSON.parse((await run({ jobId: "j9" })).content[0]!.text);
    expect(body.failure).toMatchObject({ stage: "synthesize_audio" });
    expect(body.failure.fix).toContain("voice:download");
  });
});

describe("review_video and revise_video", () => {
  const exported = {
    version: 1,
    title: "T",
    scenes: [
      {
        type: "list",
        headline:
          "One two three four five six seven eight nine ten eleven twelve",
        narration: "Short.",
      },
      { type: "statement", headline: "Two", narration: "Short again." },
    ],
  };
  beforeEach(() => {
    mocks.get.mockImplementation(async (path: string) => {
      if (path === "/api/projects")
        return { projects: [{ id: "p1", firstScriptId: "s1" }] };
      if (path.endsWith("/storyboard"))
        return { storyboard: exported, notes: [] };
      if (path.startsWith("/api/production-jobs?"))
        return {
          jobs: [
            { id: "j1", state: "succeeded", revision: { scriptId: "s1" } },
          ],
        };
      if (path.endsWith("/artifacts/o1"))
        return { artifact: { downloadUrl: "/media/renders/r.mp4" } };
      return succeededJob;
    });
    mocks.binary.mockResolvedValue(Buffer.from("jpeg"));
  });

  it("review returns suggested edits, pacing and the latest contact sheet", async () => {
    const run = register(registerCoreTools).get("review_video")!.run;
    const result = await run({ projectId: "p1" });
    const body = JSON.parse(result.content[0]!.text);
    expect(body.findings.map((f: { rule: string }) => f.rule)).toContain(
      "long-headline",
    );
    expect(body.pacing).toHaveLength(2);
    expect(body.latestVideo.state).toBe("succeeded");
    expect(result.content[1]).toMatchObject({ type: "image" });
  });

  it("revise applies the edits to the exported storyboard and produces it again", async () => {
    mocks.post.mockResolvedValue({ jobId: "j2", projectId: "p2" });
    const run = register(registerCoreTools).get("revise_video")!.run;
    await run({
      projectId: "p1",
      changes: [{ op: "update", index: 1, fields: { headline: "Short one" } }],
      set: { title: "T2" },
      wait: false,
    });
    const [url, sent] = mocks.post.mock.calls[0]!;
    expect(url).toBe("/api/storyboards?quality=standard");
    expect(sent.scenes[0].headline).toBe("Short one");
    expect(sent.title).toBe("T2");
    expect(exported.scenes[0]!.headline).toContain("One two");
  });

  it("tells the agent when a scene number does not exist", async () => {
    const run = register(registerCoreTools).get("revise_video")!.run;
    const result = await run({
      projectId: "p1",
      changes: [{ op: "remove", index: 9 }],
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Scene number 9 is out of range");
  });
});

describe("create_podcast", () => {
  it("queues a podcast storyboard and returns the episode links when done", async () => {
    mocks.post.mockResolvedValue({ jobId: "j9", podcastId: "p9", fixes: [] });
    mocks.get.mockResolvedValue({
      job: {
        status: "done",
        scene: 3,
        sceneCount: 3,
        error: null,
        podcastTake: {
          id: "t1",
          totalFrames: 4500,
          fps: 30,
          audioUrl: "/media/podcast-takes/t1.wav",
          mp3Url: "/media/podcast-takes/t1.mp3",
        },
      },
    });
    const run = register(registerCoreTools).get("create_podcast")!.run;
    const result = await run({ storyboard: { version: 1, title: "P" } });
    expect(mocks.post).toHaveBeenCalledWith("/api/storyboards", {
      version: 1,
      title: "P",
      kind: "podcast",
    });
    expect(JSON.parse(result.content[0]!.text)).toMatchObject({
      podcastId: "p9",
      state: "succeeded",
      durationSeconds: 150,
      mp3Url: "http://studio/media/podcast-takes/t1.mp3",
      packageUrl: "http://studio/api/podcast-takes/t1/bundle",
      studioUrl: "http://studio/podcasts/p9",
    });
  });

  it("can return the job straight away, and explains a failure", async () => {
    mocks.post.mockResolvedValue({ jobId: "j9", podcastId: "p9" });
    const run = register(registerCoreTools).get("create_podcast")!.run;
    const quick = JSON.parse(
      (await run({ storyboard: {}, wait: false })).content[0]!.text,
    );
    expect(quick).toMatchObject({
      jobId: "j9",
      podcastId: "p9",
      state: "queued",
    });
    mocks.get.mockResolvedValue({
      job: {
        status: "error",
        scene: 1,
        sceneCount: 3,
        error: "Kokoro model not found",
        podcastTake: null,
      },
    });
    const failed = JSON.parse((await run({ storyboard: {} })).content[0]!.text);
    expect(failed.state).toBe("failed");
    expect(failed.failure.fix).toMatch(/voice model/i);
  });
});

describe("revise_video with derive shorts", () => {
  it("asks the studio to cut the video into shorts and lists their jobs", async () => {
    mocks.get.mockImplementation(async (path: string) => {
      if (path === "/api/projects")
        return { projects: [{ id: "p1", firstScriptId: "s1" }] };
      return { storyboard: { version: 1, title: "T", scenes: [] } };
    });
    mocks.post.mockResolvedValue({
      shorts: [
        { title: "Part one", seconds: 30, jobId: "j1", projectId: "pa" },
        { title: "Part two", seconds: 28, jobId: "j2", projectId: "pb" },
      ],
    });
    const run = register(registerCoreTools).get("revise_video")!.run;
    const result = JSON.parse(
      (await run({ projectId: "p1", derive: "shorts", count: 2 })).content[0]!
        .text,
    );
    expect(mocks.post).toHaveBeenCalledWith("/api/scripts/s1/cutdowns", {
      count: 2,
      maxSeconds: undefined,
      quality: "standard",
    });
    expect(result.derived).toBe("shorts");
    expect(result.shorts.map((s: { jobId: string }) => s.jobId)).toEqual([
      "j1",
      "j2",
    ]);
    expect(result.shorts[0].studioUrl).toBe("http://studio/results/j1");
  });
});

describe("series", () => {
  it("create_video passes a series name to the studio", async () => {
    mocks.post.mockResolvedValue({ jobId: "j1", projectId: "p1" });
    const run = register(registerCoreTools).get("create_video")!.run;
    await run({
      storyboard: { version: 1 },
      wait: false,
      series: "Daily tips",
    });
    expect(mocks.post).toHaveBeenCalledWith(
      "/api/storyboards?quality=standard&series=Daily%20tips",
      { version: 1 },
    );
  });

  it("list_options names the saved series", async () => {
    mocks.get.mockResolvedValue({
      series: [{ name: "Daily tips" }, { name: "Deep dives" }],
    });
    const run = register(registerCoreTools).get("list_options")!.run;
    const options = JSON.parse((await run({})).content[0]!.text);
    expect(options.series).toEqual(["Daily tips", "Deep dives"]);
  });
});
