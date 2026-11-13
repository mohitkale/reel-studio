// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
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
    expect(mocks.autoAttachBundledMusic).toHaveBeenCalledWith("s1");
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

  it("refuses a podcast storyboard here", async () => {
    await expect(
      produceFromStoryboard(
        {
          version: 1,
          kind: "podcast",
          title: "P",
          speakers: [{ id: "a", name: "A" }],
          turns: [{ speaker: "a", text: "Hi." }],
        },
        base,
      ),
    ).rejects.toThrow(/Podcast/);
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
});
