// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  producePodcast: vi.fn(),
  createProjectFromPlan: vi.fn(),
  getScript: vi.fn(),
  updateScript: vi.fn(),
  getAssets: vi.fn(),
  getProductionJobByIdempotencyKey: vi.fn(),
  submitProduction: vi.fn(),
  autoAttachBundledMusic: vi.fn(),
  ensureSfxCues: vi.fn(),
  reportStockMediaSelectionUsage: vi.fn(),
  resolveAutomaticSceneMediaBatch: vi.fn(),
}));
vi.mock("@/library/podcast-storyboard-production", () => ({
  EPISODE_LUFS: -16,
  producePodcastFromStoryboard: mocks.producePodcast,
}));
vi.mock("@/library/repositories/projects", () => ({
  createProjectFromPlan: mocks.createProjectFromPlan,
}));
vi.mock("@/library/repositories/scripts", () => ({
  getScript: mocks.getScript,
  updateScript: mocks.updateScript,
}));
vi.mock("@/library/repositories/assets", () => ({
  getAssets: mocks.getAssets,
}));
vi.mock("@/library/repositories/production-jobs", () => ({
  getProductionJobByIdempotencyKey: mocks.getProductionJobByIdempotencyKey,
}));
vi.mock("@/library/production-service", () => ({
  submitProduction: mocks.submitProduction,
}));
vi.mock("@/library/soundtrack-service", () => ({
  autoAttachBundledMusic: mocks.autoAttachBundledMusic,
}));
vi.mock("@/library/sfx-service", () => ({
  ensureSfxCues: mocks.ensureSfxCues,
}));
// No database in a unit test: the brand kit has no stings.
vi.mock("@/library/brand-stings", () => ({
  resolveBrandStings: async () => ({}),
}));
// The person's settings are not read in a unit test: the end tag is off.
vi.mock("@/server/app-config", () => ({ getConfig: async () => ({}) }));
vi.mock("@/library/stock-media-usage", () => ({
  reportStockMediaSelectionUsage: mocks.reportStockMediaSelectionUsage,
}));
vi.mock("@/library/automatic-stock-media", () => ({
  resolveAutomaticSceneMediaBatch: mocks.resolveAutomaticSceneMediaBatch,
}));

import {
  produceFromStoryboard,
  storyboardHash,
  StoryboardLintError,
} from "./storyboard-production";

const auth = { origin: "web", token: null } as never;
const base = { auth, serverBaseUrl: "http://localhost:3000" };
const storyboard = {
  version: 1,
  title: "Two scenes",
  voice: { enabled: false },
  scenes: [
    { type: "hook", headline: "Hello", narration: "A short hook for you." },
    { type: "cta", headline: "Bye", narration: "Try it today, it is free." },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getProductionJobByIdempotencyKey.mockResolvedValue(null);
  mocks.createProjectFromPlan.mockResolvedValue({
    projectId: "p1",
    scriptId: "s1",
  });
  mocks.getScript.mockResolvedValue({ scenes: [] });
  mocks.submitProduction.mockResolvedValue({ id: "job1", state: "queued" });
});

describe("produceFromStoryboard", () => {
  it("creates the project and queues one job with captions and the chosen voice settings", async () => {
    const result = await produceFromStoryboard(storyboard, base);
    expect(result).toMatchObject({
      dryRun: false,
      jobId: "job1",
      projectId: "p1",
      scriptId: "s1",
      reused: false,
    });
    expect(mocks.createProjectFromPlan).toHaveBeenCalledTimes(1);
    // Automatic music follows the theme's music mood, as a quiet bed.
    expect(mocks.updateScript).toHaveBeenCalledWith("s1", {
      musicUrl: expect.stringMatching(/^\/music\/[a-z-]+\.wav$/),
      musicVolume: 12,
    });
    expect(mocks.autoAttachBundledMusic).not.toHaveBeenCalled();
    expect(mocks.ensureSfxCues).toHaveBeenCalledWith("s1");
    const request = mocks.submitProduction.mock.calls[0]![0].request;
    expect(request).toMatchObject({
      kind: "video",
      scriptId: "s1",
      orientation: "portrait",
      quality: "standard",
      captions: "auto",
      quickProduce: {
        enabled: true,
        planner: "deterministic",
        voice: { enabled: false },
      },
      storyboard: { title: "Two scenes" },
    });
    expect(request.idempotencyKey).toBe(
      `storyboard:${storyboardHash(
        (await import("@/storyboard")).lintStoryboard(storyboard).storyboard,
      )}`,
    );
  });

  it("does not attach music when the storyboard says none", async () => {
    await produceFromStoryboard({ ...storyboard, music: "none" }, base);
    expect(mocks.autoAttachBundledMusic).not.toHaveBeenCalled();
  });

  it("opts a storyboard above five minutes into the bounded long-form chapter plan", async () => {
    const narration = "Watch the participant and write down their decision. "
      .repeat(5)
      .trim();
    const scenes = Array.from({ length: 24 }, (_, index) => ({
      type: "hook",
      headline: `Test step ${index + 1}`,
      narration,
    }));
    const chapters = Array.from({ length: 8 }, (_, index) => ({
      title: `Chapter ${index + 1}`,
      startScene: index * 3,
    }));
    await produceFromStoryboard(
      { ...storyboard, format: "16:9", scenes, chapters },
      base,
    );
    const options = mocks.createProjectFromPlan.mock.calls[0]![5];
    expect(options.chapterTargetSeconds).toBeGreaterThan(300);
    expect(options.chapterTargetSeconds).toBeLessThanOrEqual(600);
    expect(options.chapterStarts[1]).toEqual({
      title: "Chapter 2",
      firstSceneIndex: 3,
    });
  });

  it("attaches a named bundled track", async () => {
    await produceFromStoryboard({ ...storyboard, music: "lofi-chill" }, base);
    expect(mocks.updateScript).toHaveBeenCalledWith("s1", {
      musicUrl: "/music/lofi-chill.wav",
    });
  });

  it("dryRun returns the plan and creates nothing", async () => {
    const result = await produceFromStoryboard(storyboard, {
      ...base,
      dryRun: true,
    });
    expect(result).toMatchObject({
      dryRun: true,
      plan: { orientation: "portrait", captions: "auto" },
    });
    expect(mocks.createProjectFromPlan).not.toHaveBeenCalled();
    expect(mocks.submitProduction).not.toHaveBeenCalled();
    expect(mocks.getProductionJobByIdempotencyKey).not.toHaveBeenCalled();
  });

  it("returns the existing job for the same storyboard and options", async () => {
    mocks.getProductionJobByIdempotencyKey.mockResolvedValue({
      id: "old",
      state: "succeeded",
      productionRevision: { projectId: "p0", scriptId: "s0" },
    });
    const result = await produceFromStoryboard(storyboard, base);
    expect(result).toMatchObject({
      jobId: "old",
      projectId: "p0",
      reused: true,
    });
    expect(mocks.createProjectFromPlan).not.toHaveBeenCalled();
  });

  it("force produces again with a fresh key", async () => {
    mocks.getProductionJobByIdempotencyKey.mockResolvedValue({
      id: "old",
      productionRevision: { projectId: "p0", scriptId: "s0" },
    });
    const result = await produceFromStoryboard(storyboard, {
      ...base,
      force: true,
    });
    expect(result).toMatchObject({ reused: false, jobId: "job1" });
    expect(
      mocks.submitProduction.mock.calls[0]![0].request.idempotencyKey,
    ).toMatch(/^storyboard:[0-9a-f]{64}:/);
  });

  it("different quality is a different request", () => {
    expect(storyboardHash(storyboard, { quality: "draft" })).not.toBe(
      storyboardHash(storyboard, { quality: "high" }),
    );
    expect(storyboardHash({ a: 1, b: 2 })).toBe(storyboardHash({ b: 2, a: 1 }));
  });

  it("repairs a model reply before producing and reports the fixes", async () => {
    const reply =
      "```json\n" +
      JSON.stringify({ ...storyboard, format: "vertical" }) +
      "\n```";
    const result = await produceFromStoryboard(reply, base);
    expect(result.fixes.map((f) => f.rule)).toEqual(
      expect.arrayContaining(["extract-json", "map-enum"]),
    );
    expect(mocks.createProjectFromPlan).toHaveBeenCalledTimes(1);
  });

  it("throws the lint errors, creating nothing, when the storyboard cannot be repaired", async () => {
    await expect(
      produceFromStoryboard({ version: 1, title: "T" }, base),
    ).rejects.toBeInstanceOf(StoryboardLintError);
    expect(mocks.createProjectFromPlan).not.toHaveBeenCalled();
  });

  const podcast = {
    version: 1,
    kind: "podcast",
    title: "P",
    speakers: [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ],
    turns: [
      { speaker: "a", text: "Welcome to the show today, everyone." },
      { speaker: "b", text: "Thanks for having me on the show." },
    ],
  };

  it("makes an episode from a podcast storyboard", async () => {
    mocks.producePodcast.mockResolvedValue({
      podcastId: "pod1",
      jobId: "job1",
      title: "P",
      speakers: 2,
      turns: 2,
    });
    const result = await produceFromStoryboard(podcast, base);
    expect(mocks.producePodcast).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      dryRun: false,
      kind: "podcast",
      podcastId: "pod1",
      projectId: "pod1",
      jobId: "job1",
      state: "queued",
    });
  });

  it("previews a podcast without making anything", async () => {
    const result = await produceFromStoryboard(podcast, {
      ...base,
      dryRun: true,
    });
    expect(result.dryRun).toBe(true);
    expect(mocks.producePodcast).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).toContain("-16 LUFS");
  });

  it("rejects an asset id that is not in the library", async () => {
    mocks.getAssets.mockResolvedValue([]);
    await expect(
      produceFromStoryboard(
        {
          ...storyboard,
          scenes: [
            {
              type: "media",
              headline: "Pic",
              narration: "A picture of ours.",
              media: { assetId: "missing" },
            },
          ],
        },
        base,
      ),
    ).rejects.toThrow(/Asset not found/);
  });

  it("tells the caller which scenes asked for a picture and got none, and draws them as statements (#245)", async () => {
    const scenes = [
      { type: "hook", headline: "Hello", narration: "A short hook for you." },
      {
        type: "media-split",
        headline: "The harbour",
        body: "Boats at dawn",
        narration: "Boats leave the harbour at dawn.",
        media: { query: "harbour at dawn" },
      },
      {
        type: "media",
        headline: "Sunrise",
        narration: "The sun comes up over the water.",
        media: { query: "sunrise" },
      },
    ];
    mocks.resolveAutomaticSceneMediaBatch.mockImplementation(
      async (planned: unknown[]) =>
        planned.map(() => ({
          state: "no-provider",
          attemptedProviders: [],
          message: "No configured stock provider",
        })),
    );
    const result = await produceFromStoryboard({ ...storyboard, scenes }, base);
    // Both pictures were looked for (a media-split scene was never searched for before).
    expect(mocks.resolveAutomaticSceneMediaBatch).toHaveBeenCalledTimes(1);
    expect(
      result.warnings
        .filter((w) => w.rule === "media-unresolved")
        .map((w) => w.path),
    ).toEqual(["scenes.1.media", "scenes.2.media"]);
    const request = mocks.submitProduction.mock.calls[0]![0].request;
    expect(
      request.storyboard.warnings.filter((w: string) =>
        w.startsWith("scenes.1.media: Scene 2 (media-split) has no picture"),
      ),
    ).toHaveLength(1);
    // No empty box: neither scene keeps a picture template.
    const planned = mocks.createProjectFromPlan.mock.calls[0]![0];
    expect(
      planned.scenes.map((scene: { templateId: string }) => scene.templateId),
    ).not.toContain("hf-media-split");
    expect(
      planned.scenes.map((scene: { templateId: string }) => scene.templateId),
    ).not.toContain("hf-broll");
  });
});
