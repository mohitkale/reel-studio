import { describe, expect, it } from "vitest";

import {
  moveScene,
  moveSceneTo,
  sceneStripChanged,
  toUndoScene,
} from "@/lib/scene-strip";
import type { SceneDTO } from "@/lib/dto";

const scene = (id: string, text: string, spokenText: string | null = null) =>
  ({
    id,
    scriptId: "s",
    order: 0,
    templateId: "hero",
    text,
    spokenText,
    emphasis: ["a"],
    hideText: null,
    selectedVoiceClipId: null,
  }) as SceneDTO;

describe("scene strip helpers", () => {
  it("moves a scene up or down and ignores moves off the ends", () => {
    expect(moveScene(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveScene(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
    expect(moveScene(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moveScene(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });

  it("copies scenes so later edits cannot change the snapshot", () => {
    const original = scene("a", "Hello");
    const snap = toUndoScene(original);
    original.emphasis.push("b");
    expect(snap.emphasis).toEqual(["a"]);
    expect(snap.id).toBe("a");
  });

  it("moves scenes across the strip and ignores a stale drag", () => {
    const ids = ["a", "b", "c", "d"];
    expect(moveSceneTo(ids, "a", "c")).toEqual(["b", "c", "a", "d"]);
    expect(moveSceneTo(ids, "d", "b")).toEqual(["a", "d", "b", "c"]);
    expect(moveSceneTo(ids, "a", "removed")).toBe(ids);
    expect(moveSceneTo(ids, "a", "a")).toBe(ids);
  });

  it("notices text, narration and order changes but not untouched scenes", () => {
    const base = [scene("a", "One"), scene("b", "Two")].map(toUndoScene);
    expect(
      sceneStripChanged(base, [scene("a", "One"), scene("b", "Two")]),
    ).toBe(false);
    expect(
      sceneStripChanged(base, [scene("a", "One!"), scene("b", "Two")]),
    ).toBe(true);
    expect(
      sceneStripChanged(base, [scene("a", "One"), scene("b", "Two", "Say it")]),
    ).toBe(true);
    expect(
      sceneStripChanged(base, [scene("b", "Two"), scene("a", "One")]),
    ).toBe(true);
    expect(sceneStripChanged(base, [scene("a", "One")])).toBe(true);
    expect(
      sceneStripChanged(base, [
        { ...scene("a", "One"), templateId: "hf-quote" },
        scene("b", "Two"),
      ]),
    ).toBe(true);
    expect(
      sceneStripChanged(base, [
        {
          ...scene("a", "One"),
          background: { type: "image", url: "/media/fixture.png" },
        },
        scene("b", "Two"),
      ]),
    ).toBe(true);
  });
});
