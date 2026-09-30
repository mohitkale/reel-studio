// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, updateScene, updateScript, transaction } = vi.hoisted(
  () => ({
    findUnique: vi.fn(),
    updateScene: vi.fn(),
    updateScript: vi.fn(),
    transaction: vi.fn(),
  }),
);
vi.mock("@/library/db", () => ({ prisma: { $transaction: transaction } }));

import { replanMotionDirection } from "@/library/motion-direction-service";
import { motionDirection } from "@/production/motion";

function row(
  id: string,
  config: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    scriptId: "script",
    order: 0,
    templateId: "hf-statement",
    text: "Clear copy",
    spokenText: "Original narration",
    emphasis: "[]",
    visual: null,
    assetRefs: '["image-1"]',
    hideText: null,
    selectedVoiceClipId: "clip-1",
    layoutJson: JSON.stringify({
      role: "headline",
      motion: motionDirection("type-impact"),
      musicMood: "quiet",
      ...config,
    }),
    ...extra,
  };
}
function script(scenes = [row("scene")]) {
  return {
    id: "script",
    hideText: false,
    brandOverrides: JSON.stringify({
      styleId: "clean-story",
      energy: "calm",
      customToken: "keep",
      productionPreset: { id: "creator-punch", version: "1.0.0" },
      motionPlan: { version: "1.0.0", seed: "saved", ambition: "showcase" },
    }),
    scenes,
  };
}

describe("direction replanning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transaction.mockImplementation(async (callback) =>
      callback({
        script: { findUnique, update: updateScript },
        scene: { update: updateScene },
      }),
    );
    updateScene.mockResolvedValue({});
    updateScript.mockResolvedValue({});
  });

  it("writes only direction and settings while preserving content and unrelated config", async () => {
    const original = script([
      row("scene", {
        mood: "calm",
        customLayout: { x: 30 },
        locks: { copy: true, assets: true, scene: false },
      }),
    ]);
    const before = structuredClone(original);
    findUnique.mockResolvedValue(original);
    const result = await replanMotionDirection("script", { ambition: "clean" });
    expect(result).toMatchObject({
      state: "planned",
      changedSceneIds: ["scene"],
      settings: { seed: "saved", ambition: "clean" },
    });
    expect(updateScene.mock.calls[0][0].where).toEqual({ id: "scene" });
    expect(Object.keys(updateScene.mock.calls[0][0].data)).toEqual([
      "layoutJson",
    ]);
    expect(JSON.parse(updateScene.mock.calls[0][0].data.layoutJson)).toEqual({
      ...JSON.parse(original.scenes[0].layoutJson),
      motion: motionDirection("type-editorial"),
    });
    const overrides = JSON.parse(
      updateScript.mock.calls[0][0].data.brandOverrides,
    );
    expect(overrides).toMatchObject({
      customToken: "keep",
      styleId: "clean-story",
      energy: "calm",
      motionPlan: { seed: "saved", ambition: "clean" },
    });
    expect(original).toEqual(before);
    expect(transaction).toHaveBeenCalledOnce();
  });

  it("protects locked treatments, locked preset looks, and hidden text", async () => {
    const locked = { copy: false, assets: false, scene: true };
    findUnique.mockResolvedValue(
      script([
        row("locked", { locks: locked }),
        row("preset", { locks: locked, motion: undefined }),
        row("hidden", {}, { hideText: true }),
      ]),
    );
    expect(
      await replanMotionDirection("script", { ambition: "clean" }),
    ).toMatchObject({ changedSceneIds: [], protectedSceneCount: 3 });
    expect(updateScene).not.toHaveBeenCalled();
  });

  it("honors per-scene visibility overrides and clears unsupported unlocked choices", async () => {
    findUnique.mockResolvedValue({
      ...script([
        row("visible", {}, { hideText: false }),
        row("hidden"),
        row(
          "video",
          { background: { type: "video", url: "/media/clip.mp4" } },
          { hideText: false },
        ),
      ]),
      hideText: true,
    });
    expect(
      await replanMotionDirection("script", { ambition: "clean" }),
    ).toMatchObject({
      changedSceneIds: ["visible", "video"],
      protectedSceneCount: 1,
    });
    expect(
      JSON.parse(updateScene.mock.calls[1][0].data.layoutJson).motion,
    ).toBeUndefined();
    expect(
      JSON.parse(updateScene.mock.calls[1][0].data.layoutJson).background.url,
    ).toBe("/media/clip.mp4");
  });

  it("saves a new seed only when variation is requested", async () => {
    findUnique.mockResolvedValue(script());
    const result = await replanMotionDirection("script", {
      newVariation: true,
    });
    expect(result.state).toBe("planned");
    if (result.state === "planned") {
      expect(result.settings.seed).not.toBe("saved");
      expect(result.settings.ambition).toBe("showcase");
    }
  });

  it("requires a valid outline, saves chapter motifs and detects changes within the same recipe", async () => {
    findUnique.mockResolvedValue(script());
    await expect(
      replanMotionDirection("script", { chapterMotifs: true }),
    ).rejects.toMatchObject({ status: 400 });
    expect(updateScene).not.toHaveBeenCalled();
    const original = script([
      row("a", { motion: motionDirection("type-editorial") }),
      row("b", { motion: motionDirection("type-editorial") }),
    ]);
    original.brandOverrides = JSON.stringify({
      ...JSON.parse(original.brandOverrides),
      chapterPlan: {
        version: "1.0.0",
        chapters: [
          { id: "one", title: "One", firstSceneId: "a" },
          { id: "two", title: "Two", firstSceneId: "b" },
        ],
      },
    });
    findUnique.mockResolvedValue(original);
    const result = await replanMotionDirection("script", {
      chapterMotifs: true,
      ambition: "clean",
    });
    expect(result).toMatchObject({
      changedSceneIds: ["a", "b"],
      settings: { chapterMotifs: true },
    });
    const motifs = updateScene.mock.calls.map(
      ([input]) => JSON.parse(input.data.layoutJson).motion.typeEntrance,
    );
    expect(motifs[0]).not.toBe(motifs[1]);
    expect(motifs.sort()).toEqual(["rise", "sweep"]);
  });

  it("does not write unchanged choices or legacy projects", async () => {
    findUnique.mockResolvedValue(
      script([row("scene", { motion: motionDirection("type-editorial") })]),
    );
    expect(
      await replanMotionDirection("script", { ambition: "clean" }),
    ).toMatchObject({ changedSceneIds: [] });
    expect(updateScene).not.toHaveBeenCalled();
    updateScript.mockClear();
    findUnique.mockResolvedValue({ ...script(), brandOverrides: null });
    expect(await replanMotionDirection("script", {})).toEqual({
      state: "legacy",
    });
    expect(updateScript).not.toHaveBeenCalled();
    findUnique.mockResolvedValue(null);
    expect(await replanMotionDirection("missing", {})).toEqual({
      state: "not_found",
    });
  });
});
