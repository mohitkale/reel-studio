// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  script: vi.fn(),
  generate: vi.fn(),
  configured: vi.fn(),
  capture: vi.fn(),
  commit: vi.fn(),
  append: vi.fn(),
  media: vi.fn(),
}));
vi.mock("@/server/auth", () => ({ authorizeProviderRequest: mocks.auth }));
vi.mock("@/library/repositories/scripts", () => ({ getScript: mocks.script }));
vi.mock("@/providers/ai/registry", () => ({
  isAIProviderId: () => true,
  getAIProvider: () => ({
    isConfigured: mocks.configured,
    generatePlan: mocks.generate,
    label: "Test provider",
  }),
}));
vi.mock("@/library/scene-rewrite-service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/library/scene-rewrite-service")>()),
  captureSceneRewriteState: mocks.capture,
  commitSceneRewrite: mocks.commit,
}));
vi.mock("@/library/scene-append-service", () => ({
  commitSceneAppend: mocks.append,
}));
vi.mock("@/library/automatic-stock-media", () => ({
  resolveAutomaticSceneMediaBatch: mocks.media,
}));
vi.mock("@/library/stock-media-usage", () => ({
  reportStockMediaSelectionUsage: vi.fn(),
}));
import { POST } from "./route";
import { AIError } from "@/providers/ai/types";
const context = { params: Promise.resolve({ id: "script" }) };
const body = {
  providerId: "openai",
  mode: "rewrite",
  brief: "Make the proof clearer",
  chapterId: "proof",
};
const request = (input: unknown = body) =>
  new Request("http://localhost/api/scripts/script/ai", {
    method: "POST",
    body: typeof input === "string" ? input : JSON.stringify(input),
  });
function script(engine = "hyperframes") {
  return {
    id: "script",
    width: 1080,
    height: 1920,
    videoEngine: engine,
    chapterPlan: {
      version: "1.0.0",
      chapters: [
        { id: "intro", title: "Question", firstSceneId: "scene-0" },
        { id: "proof", title: "Proof", firstSceneId: "scene-20" },
      ],
    },
    scenes: Array.from({ length: 24 }, (_, index) => ({
      id: `scene-${index}`,
      order: index,
      text: `Original ${index}`,
      emphasis: [],
      mediaPreference: "none",
      locks: { scene: index === 22, copy: index === 21, assets: true },
    })),
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue("web");
  mocks.configured.mockReturnValue(true);
  mocks.capture.mockResolvedValue("same-draft");
  mocks.script.mockResolvedValue(script());
  mocks.append.mockResolvedValue(["new-0", "new-1", "new-2"]);
  mocks.media.mockImplementation(async (scenes: unknown[]) =>
    scenes.map(() => ({
      state: "disabled",
      attemptedProviders: [],
      message: "Disabled",
    })),
  );
  mocks.generate.mockResolvedValue({
    projectName: "Project",
    scriptName: "Script",
    scenes: Array.from({ length: 3 }, (_, index) => ({
      templateId: "hf-statement",
      text: `New ${index}`,
      emphasis: [],
    })),
  });
});
it("uses chapter-local context and global replacement positions for both engines and web/MCP callers", async () => {
  for (const engine of ["hyperframes", "remotion"])
    for (const origin of ["web", "mcp"]) {
      mocks.auth.mockResolvedValue(origin);
      mocks.script.mockResolvedValue(script(engine));
      const response = await POST(request(), context);
      expect(response.status).toBe(200);
      expect(mocks.generate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sceneCount: 3,
          replacementSceneNumbers: [21, 22, 24],
          videoEngine: engine,
          existingContext: expect.stringContaining("Chapter: Proof"),
        }),
      );
      const sent = mocks.generate.mock.lastCall![0];
      expect(sent.existingContext).toContain("Scene 20");
      expect(sent.existingContext).not.toContain("Original 0");
      expect(
        mocks.commit.mock.lastCall![0].targets.map(
          (scene: { id: string }) => scene.id,
        ),
      ).toEqual(["scene-20", "scene-21", "scene-23"]);
      expect(await response.json()).toMatchObject({
        changedSceneIds: ["scene-20", "scene-21", "scene-23"],
      });
    }
});
it("rejects invalid scopes before provider work, wrong result counts and stale generation before writes", async () => {
  for (const input of [
    "{",
    {},
    { ...body, mode: "append" },
    { ...body, chapterId: "missing" },
    { ...body, sceneIds: ["scene-0"] },
    { ...body, chapterId: undefined },
  ])
    expect((await POST(request(input), context)).status).toBe(400);
  expect(mocks.generate).not.toHaveBeenCalled();
  expect(mocks.commit).not.toHaveBeenCalled();
  mocks.auth.mockRejectedValueOnce(new AIError("Forbidden", 403));
  expect((await POST(request(), context)).status).toBe(403);
  mocks.generate.mockResolvedValueOnce({ scenes: [] });
  expect((await POST(request(), context)).status).toBe(502);
  expect(mocks.commit).not.toHaveBeenCalled();
  mocks.commit.mockRejectedValueOnce(new AIError("Storyboard changed", 409));
  expect((await POST(request(), context)).status).toBe(409);
  mocks.capture.mockResolvedValueOnce("old").mockResolvedValueOnce("new");
  const calls = mocks.generate.mock.calls.length;
  expect((await POST(request(), context)).status).toBe(409);
  expect(mocks.generate.mock.calls.length).toBe(calls);
});

it("appends a named chapter through one bounded call for both engines and web/MCP callers", async () => {
  for (const engine of ["hyperframes", "remotion"])
    for (const origin of ["web", "mcp"]) {
      mocks.auth.mockResolvedValue(origin);
      mocks.script.mockResolvedValue(script(engine));
      mocks.generate.mockClear();
      const response = await POST(
        request({
          ...body,
          chapterId: undefined,
          mode: "append",
          chapterTitle: " Next topic ",
          sceneCount: 3,
          mediaPreference: "none",
        }),
        context,
      );
      expect(response.status).toBe(200);
      expect(mocks.generate).toHaveBeenCalledTimes(1);
      expect(mocks.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "append",
          sceneCount: 3,
          chapterTitle: "Next topic",
          existingSceneCount: 24,
          videoEngine: engine,
        }),
      );
      const input = mocks.generate.mock.lastCall![0];
      expect(input.existingContext).toContain("Original 22");
      expect(input.existingContext).not.toContain("Original 21");
      expect(mocks.append).toHaveBeenLastCalledWith(
        expect.objectContaining({
          expectedState: "same-draft",
          chapterTitle: "Next topic",
          scenes: expect.arrayContaining([
            expect.objectContaining({ text: "New 0" }),
          ]),
        }),
      );
      expect(mocks.commit).not.toHaveBeenCalled();
    }
});
it("rejects invalid append outlines and requests before provider work and malformed/stale results before persistence", async () => {
  const append = {
    ...body,
    mode: "append",
    chapterId: undefined,
    chapterTitle: "Next",
    sceneCount: 3,
  };
  for (const input of [
    { ...append, chapterId: "proof" },
    { ...append, chapterTitle: " " },
    { ...append, sceneCount: 21 },
    { ...append, sceneIds: ["scene-0"] },
    { ...append, mode: "rewrite" },
  ])
    expect((await POST(request(input), context)).status).toBe(400);
  mocks.script.mockResolvedValueOnce({ ...script(), chapterPlan: undefined });
  expect((await POST(request(append), context)).status).toBe(400);
  mocks.script.mockResolvedValueOnce({
    ...script(),
    chapterPlan: {
      ...script().chapterPlan,
      chapters: [script().chapterPlan.chapters[0]],
    },
  });
  expect((await POST(request(append), context)).status).toBe(400);
  expect(mocks.generate).not.toHaveBeenCalled();
  mocks.generate.mockResolvedValueOnce({
    projectName: "Project",
    scriptName: "Script",
    scenes: [{ templateId: "hf-statement", text: "Only one", emphasis: [] }],
  });
  expect((await POST(request(append), context)).status).toBe(502);
  expect(mocks.media).not.toHaveBeenCalled();
  expect(mocks.append).not.toHaveBeenCalled();
  mocks.append.mockRejectedValueOnce(new AIError("Storyboard changed", 409));
  expect((await POST(request(append), context)).status).toBe(409);
  mocks.capture.mockResolvedValueOnce("old").mockResolvedValueOnce("new");
  const calls = mocks.generate.mock.calls.length;
  expect((await POST(request(append), context)).status).toBe(409);
  expect(mocks.generate.mock.calls.length).toBe(calls);
});
