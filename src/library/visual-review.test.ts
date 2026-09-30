// @vitest-environment node
import { promises as fs } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  render: vi.fn(),
  files: new Map<string, Buffer>(),
}));
vi.mock("@/library/video-snapshot", () => ({
  captureVideoSnapshot: mocks.capture,
}));
vi.mock("@remotion/bundler", () => ({
  bundle: vi.fn(async () => "fixture-bundle"),
}));
vi.mock("@remotion/renderer", async (original) => ({
  ...(await original<typeof import("@remotion/renderer")>()),
  renderMedia: vi.fn(),
  selectComposition: vi.fn(async () => ({
    id: "Reel",
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 90,
  })),
  renderStill: mocks.render,
}));
vi.mock("@/library/storage", () => ({
  getAssetStore: () => ({
    exists: async (key: string) => mocks.files.has(key),
    put: async (key: string, value: Buffer) => {
      mocks.files.set(key, value);
      return { key };
    },
    url: (key: string) => `/media/${key}`,
  }),
}));
vi.mock("@/library/video-stage-media", async (original) => ({
  ...(await original<typeof import("@/library/video-stage-media")>()),
  resolveVideoStageMedia: async (snapshot: unknown) => ({
    snapshot,
    assets: [],
  }),
}));
import { createVisualReview } from "./visual-review";
import { videoSnapshotSchema } from "@/production/video-snapshot";
import { serverDefaultTokens } from "@/lib/brand-defaults";
const snapshot = videoSnapshotSchema.parse({
  version: 1,
  take: null,
  script: {
    id: "script",
    projectId: "project",
    name: "Review",
    fps: 30,
    width: 1080,
    height: 1920,
    videoEngine: "remotion",
    scenes: [
      {
        id: "scene",
        scriptId: "script",
        order: 0,
        templateId: "hook",
        text: "A clear idea",
        spokenText: null,
        emphasis: [],
        hideText: null,
        selectedVoiceClipId: null,
        motion: { recipeId: "type-impact", version: "1.0.0" },
      },
    ],
    brandTokens: serverDefaultTokens,
    coverUrl: null,
    musicUrl: null,
    musicVolume: 20,
    sfxEnabled: false,
    sfxJson: null,
    hideText: false,
    hideProgressBar: false,
    styleId: "bold-hook",
    energy: "normal",
    productionPreset: { id: "creator-punch", version: "1.0.0" },
  },
});
const input = { sceneIds: ["scene"], samples: 1 as const };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.files.clear();
  mocks.capture.mockImplementation(async () => structuredClone(snapshot));
  mocks.render.mockImplementation(async ({ output }: { output: string }) => {
    await fs.writeFile(output, Buffer.from("captured frame"));
  });
});
describe("cached visual review", () => {
  it("cancels queued requests without reading or rendering a video", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      createVisualReview(
        "script",
        input,
        "http://localhost:3000",
        controller.signal,
      ),
    ).rejects.toThrow();
    expect(mocks.capture).not.toHaveBeenCalled();
    expect(mocks.render).not.toHaveBeenCalled();
    await createVisualReview("script", input, "http://localhost:3000");
    expect(mocks.render).toHaveBeenCalledOnce();
  });
  it("caches exact frames, preserves direction and repairs a removed cache file", async () => {
    const first = await createVisualReview(
      "script",
      input,
      "http://localhost:3000",
    );
    expect(first.stills).toHaveLength(1);
    expect(first.takeUsable).toBe(false);
    expect(mocks.render).toHaveBeenCalledWith(
      expect.objectContaining({
        inputProps: expect.objectContaining({
          scenes: [
            expect.objectContaining({
              motion: snapshot.script.scenes[0].motion,
            }),
          ],
        }),
      }),
    );
    expect(
      await createVisualReview("script", input, "http://localhost:3000"),
    ).toEqual(first);
    expect(mocks.render).toHaveBeenCalledOnce();
    mocks.files.clear();
    await createVisualReview("script", input, "http://localhost:3000");
    expect(mocks.render).toHaveBeenCalledTimes(2);
  });
  it("invalidates stills after visual edits and rejects removed scenes before capture", async () => {
    const first = await createVisualReview(
      "script",
      input,
      "http://localhost:3000",
    );
    const edited = structuredClone(snapshot);
    edited.script.scenes[0].text = "Another idea";
    mocks.capture.mockResolvedValue(edited);
    const second = await createVisualReview(
      "script",
      input,
      "http://localhost:3000",
    );
    expect(second.revision).not.toBe(first.revision);
    expect(second.stills[0].url).not.toBe(first.stills[0].url);
    await expect(
      createVisualReview(
        "script",
        { sceneIds: ["removed"], samples: 1 },
        "http://localhost:3000",
      ),
    ).rejects.toThrow("no longer exists");
    expect(mocks.render).toHaveBeenCalledTimes(2);
  });
  it("returns advisory findings from the same saved scene and estimated timing as its stills", async () => {
    const edited = structuredClone(snapshot);
    edited.script.scenes[0].text = "a".repeat(121);
    edited.script.scenes[0].spokenText = "Short narration";
    mocks.capture.mockResolvedValue(edited);
    const result = await createVisualReview(
      "script",
      input,
      "http://localhost:3000",
    );
    expect(result.findings.map((finding) => finding.kind)).toEqual([
      "fallback",
      "reading-time",
    ]);
    expect(
      result.findings.every(
        (finding) => finding.sceneId === "scene" && finding.frame === 0,
      ),
    ).toBe(true);
    edited.script.hideText = true;
    mocks.capture.mockResolvedValue(edited);
    expect(
      (await createVisualReview("script", input, "http://localhost:3000"))
        .findings,
    ).toEqual([]);
  });
  it("does not publish a failed capture and retries successfully", async () => {
    mocks.render.mockRejectedValueOnce(new Error("Media unavailable"));
    await expect(
      createVisualReview("script", input, "http://localhost:3000"),
    ).rejects.toThrow("Media unavailable");
    expect(mocks.files.size).toBe(0);
    await createVisualReview("script", input, "http://localhost:3000");
    expect(mocks.files.size).toBe(1);
  });
});
