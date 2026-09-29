// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const { getScript, updateScript } = vi.hoisted(() => ({
  getScript: vi.fn(),
  updateScript: vi.fn(),
}));
vi.mock("@/library/repositories/scripts", () => ({ getScript, updateScript }));

import { buildAutomaticSfxCues, ensureSfxCues } from "@/library/sfx-service";
import { motionDirection } from "@/production/motion";
import type { SceneDTO } from "@/lib/dto";
import { parseSfxState } from "@/lib/sfx-cues";

function scene(id: string): SceneDTO {
  return {
    id,
    scriptId: "script",
    order: 0,
    templateId: "hf-kinetic-slam",
    text: "A clear moment",
    spokenText: null,
    emphasis: [],
    hideText: null,
    selectedVoiceClipId: null,
    role: "hook",
    motion: motionDirection("type-impact"),
  };
}
beforeEach(() => vi.clearAllMocks());

describe("scene-aware SFX suggestions", () => {
  it("suggests a versioned event for Impact and leaves quieter looks silent", () => {
    expect(buildAutomaticSfxCues([scene("hit")])[0]).toMatchObject({
      source: "automatic",
      event: { recipeId: "type-impact", anchor: "impact" },
      offsetSeconds: 0,
    });
    expect(
      buildAutomaticSfxCues([
        { ...scene("quiet"), motion: motionDirection("type-editorial") },
      ]),
    ).toEqual([]);
    expect(
      buildAutomaticSfxCues([{ ...scene("hidden"), hideText: true }]),
    ).toEqual([]);
    expect(
      buildAutomaticSfxCues([{ ...scene("legacy"), motion: undefined }])[0],
    ).toMatchObject({
      sfxId: "soft-hit",
      offsetSeconds: 0.12,
      source: "automatic",
    });
  });

  it("refreshes only automatic suggestions and preserves manual, legacy, locked and muted cues", async () => {
    const original = [
      { sceneId: "legacy", sfxId: "swipe", volume: 0.22, offsetSeconds: 0.35 },
      {
        sceneId: "manual",
        sfxId: "click",
        volume: 0,
        offsetSeconds: 0.72,
        source: "manual",
      },
      {
        sceneId: "locked",
        sfxId: "pop",
        volume: 0.3,
        offsetSeconds: 0.22,
        source: "automatic",
        locked: true,
      },
      {
        sceneId: "refresh",
        sfxId: "whoosh",
        volume: 0.2,
        offsetSeconds: 0.1,
        source: "automatic",
      },
    ];
    getScript.mockResolvedValue({
      scenes: ["legacy", "manual", "locked", "refresh"].map(scene),
      hideText: false,
      sfxEnabled: true,
      sfxJson: JSON.stringify({ enabled: true, cues: original }),
    });
    await ensureSfxCues("script", { force: true });
    const saved = parseSfxState(updateScript.mock.calls[0][1].sfxJson);
    expect(saved.cues.slice(0, 3)).toEqual(original.slice(0, 3));
    expect(saved.cues[3]).toMatchObject({
      sceneId: "refresh",
      sfxId: "soft-hit",
      event: { anchor: "impact" },
    });
    expect(saved.cues).toHaveLength(4);
  });

  it("honors disable flags and requires explicit re-enabling", async () => {
    getScript.mockResolvedValue({
      scenes: [scene("hit")],
      hideText: false,
      sfxEnabled: true,
      sfxJson: '{"enabled":false,"cues":[]}',
    });
    expect(await ensureSfxCues("script", { force: true })).toEqual({
      attached: false,
      reason: "disabled",
    });
    expect(updateScript).not.toHaveBeenCalled();
    expect(
      await ensureSfxCues("script", { force: true, enabled: true }),
    ).toMatchObject({ attached: true, cueCount: 1 });
  });
});
