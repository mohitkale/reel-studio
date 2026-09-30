import { describe, expect, it } from "vitest";
import {
  chooseSceneMotion,
  motionDirection,
  motionDirectionSchema,
  motionFallbackReason,
  STORY_MOTION_RECIPES,
} from "./motion";
import { planMotionSequence } from "./motion-plan";
import { STORY_MOTION_TRACKS, storyBrandName } from "./story-motion";
import { buildStoryMotionScene } from "@/engines/hyperframes/motion/story-scenes";
import { buildHyperframesCompositionHtml } from "@/engines/hyperframes/build-composition";
import { defaultBrandTokens } from "@/compositions/tokens";
import { buildAutomaticSfxCues } from "@/lib/sfx-planner";
import type { ReelProps } from "@/compositions/types";
import type { SceneDTO } from "@/lib/dto";
import { motionEventOffsetSeconds } from "./motion-events";

const settings = {
  version: "1.0.0" as const,
  seed: "unrelated-brief",
  ambition: "expressive" as const,
};
const comparison = {
  role: "comparison" as const,
  text: "Read both accounts",
  items: ["Eyewitness diary", "Later oral account"],
};
const scene = {
  ...comparison,
  id: "a",
  order: 0,
  templateId: "hf-statement",
  emphasis: [],
};

describe("authored comparison, quiet and brand families", () => {
  it("validates supplied content before selection without inventing labels or hiding media", () => {
    expect(chooseSceneMotion(comparison)?.recipeId).toBe("comparison-split");
    for (const items of [
      undefined,
      [],
      ["One"],
      ["One", ""],
      ["One", "x".repeat(61)],
      ["One", "Two", "Three"],
    ]) {
      expect(chooseSceneMotion({ ...comparison, items })).toBeUndefined();
    }
    expect(
      chooseSceneMotion({ ...comparison, hasVisualContent: true }),
    ).toBeUndefined();
    expect(
      chooseSceneMotion({
        ...comparison,
        background: { type: "image", url: "/supplied.png" },
      }),
    ).toBeUndefined();
    expect(
      chooseSceneMotion({
        ...comparison,
        items: undefined,
        chart: {
          labels: ["A", "B"],
          series: [{ label: "Value", values: [1, 2] }],
        },
      })?.recipeId,
    ).toBe("data-bars");
    for (const role of ["summary", "explanation", "cta", "logo"] as const) {
      expect(chooseSceneMotion({ role, text: "A reading hold" })).toBeDefined();
      expect(
        chooseSceneMotion({
          role,
          text: "A reading hold",
          items: ["Keep this"],
        }),
      ).toBeUndefined();
    }
  });

  it("rejects oversized copy, empty copy and other visuals for every saved recipe", () => {
    for (const recipe of STORY_MOTION_RECIPES) {
      const direction = motionDirection(recipe.id);
      expect(motionDirectionSchema.safeParse(direction).success).toBe(true);
      const items = recipe.id.startsWith("comparison-")
        ? comparison.items
        : undefined;
      expect(
        motionFallbackReason(
          direction,
          "A clear idea",
          undefined,
          false,
          items,
        ),
      ).toBeUndefined();
      expect(
        motionFallbackReason(
          direction,
          "x".repeat(recipe.maxCharacters + 1),
          undefined,
          false,
          items,
        ),
      ).toBeTruthy();
      expect(
        motionFallbackReason(direction, "", undefined, false, items),
      ).toBeTruthy();
      expect(
        motionFallbackReason(direction, "A clear idea", undefined, true, items),
      ).toBeTruthy();
    }
  });

  it("keeps locks and semantic families, varies adjacent layouts and continues append history", () => {
    const scenes = [
      comparison,
      comparison,
      { role: "summary" as const, text: "Pause for context" },
      { role: "summary" as const, text: "Continue calmly" },
      { role: "cta" as const, text: "Keep exploring" },
      { role: "cta" as const, text: "Stay curious" },
    ];
    const before = structuredClone(scenes);
    const planned = planMotionSequence(scenes, settings);
    expect(planMotionSequence(scenes, settings)).toEqual(planned);
    expect(scenes).toEqual(before);
    expect(planned.map((motion) => motion?.recipeId.split("-")[0])).toEqual([
      "comparison",
      "comparison",
      "quiet",
      "quiet",
      "brand",
      "brand",
    ]);
    for (const index of [0, 2, 4])
      expect(planned[index]?.recipeId).not.toBe(planned[index + 1]?.recipeId);
    expect(
      planMotionSequence(scenes.slice(2), settings, planned.slice(0, 2)),
    ).toEqual(planned.slice(2));
    const locked = motionDirection("comparison-stack");
    expect(
      planMotionSequence(
        [
          { ...comparison, locked: true, current: locked },
          { ...comparison, locked: true },
        ],
        settings,
      ),
    ).toEqual([locked, undefined]);
    expect(chooseSceneMotion({ ...comparison, current: locked })).toEqual(
      locked,
    );
  });

  it("keeps authored event landmarks synchronized and leaves these families silent by default", () => {
    for (const recipe of STORY_MOTION_RECIPES) {
      const tracks = STORY_MOTION_TRACKS[recipe.id];
      const primary = tracks.find(
        (track) =>
          track.part ===
          (recipe.id.startsWith("comparison-") ? "label-0" : "title"),
      )!;
      expect(
        motionEventOffsetSeconds(
          motionDirection(recipe.id),
          "reveal",
          "hyperframes",
          30,
        ),
      ).toBe(primary.at);
      for (const fps of [24, 30, 60])
        expect(
          motionEventOffsetSeconds(
            motionDirection(recipe.id),
            "reveal",
            "remotion",
            fps,
          ),
        ).toBe(Math.round(primary.at * 30) / fps);
      expect(
        Math.max(...tracks.map((track) => track.at + track.duration)),
      ).toBeLessThanOrEqual(2.4);
      const supplied = {
        ...scene,
        role: "cta",
        items: recipe.id.startsWith("comparison-")
          ? comparison.items
          : undefined,
        motion: motionDirection(recipe.id),
      } as unknown as SceneDTO;
      expect(buildAutomaticSfxCues([supplied])).toEqual([]);
    }
    expect(storyBrandName(" ")).toBe("");
    expect(storyBrandName("x".repeat(61))).toBe("");
    expect(storyBrandName("Archive & Notes")).toBe("Archive & Notes");
  });

  it("routes all six native compositions, escapes supplied copy and falls back when inputs change", async () => {
    for (const recipe of STORY_MOTION_RECIPES) {
      const current = {
        ...scene,
        text: "<read & compare>",
        items: recipe.id.startsWith("comparison-")
          ? ["<first>", "second & last"]
          : undefined,
        motion: motionDirection(recipe.id),
      };
      const args = {
        scene: current,
        tokens: { ...defaultBrandTokens, handle: "<Archive>" },
        width: 1080,
        height: 1080,
        absoluteStart: 0,
        duration: 4,
        exitWindow: 0.1,
        transitionClass: "",
      };
      const html = buildStoryMotionScene(args)!;
      expect(html).toContain(`data-motion-recipe="${recipe.id}"`);
      expect(html).toContain("&lt;read &amp; compare&gt;");
      expect(html).not.toContain("<Archive>");
      if (recipe.id.startsWith("comparison-"))
        expect(html).toContain("&lt;first&gt;");
      expect(
        buildStoryMotionScene({
          ...args,
          scene: { ...current, hideText: true },
        }),
      ).toBeNull();
      expect(
        buildStoryMotionScene({
          ...args,
          scene: { ...current, visual: "Do not hide" },
        }),
      ).toBeNull();
      const props: ReelProps = {
        scenes: [current],
        timeline: [{ sceneId: current.id, startFrame: 0, durationFrames: 120 }],
        tokens: args.tokens,
        width: 1080,
        height: 1080,
        fps: 30,
      };
      expect(buildHyperframesCompositionHtml(props)).toContain(
        `class="fx-stage sm-stage sm-${recipe.id}"`,
      );
    }
  });
});
