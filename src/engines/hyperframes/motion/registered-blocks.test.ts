import { expect, it } from "vitest";
import { EXTENSION_MOTION_RECIPES } from "@/video/motion-extensions";
import { MOTION_SAMPLES } from "@/video/motion-samples";
import { defaultBrandTokens } from "@/video/tokens";
import {
  motionDirection,
  motionRecipeIdSchema,
  chooseSceneMotion,
  motionFallbackReason,
} from "@/production/motion";
import { buildHyperframesCompositionHtml } from "../build-composition";
import { REGISTERED_MOTION_BLOCKS } from "./registered-blocks";

it("dispatches every registered block with its supplied content and no invented claims", () => {
  expect(REGISTERED_MOTION_BLOCKS.map((block) => block.recipe.id)).toEqual(
    EXTENSION_MOTION_RECIPES.map((recipe) => recipe.id),
  );
  expect(
    chooseSceneMotion({ role: "quote", text: "Supplied quotation" })?.recipeId,
  ).toBe("quote-margin");
  for (const scene of MOTION_SAMPLES) {
    expect(motionRecipeIdSchema.parse(scene.motion!.recipeId)).toBe(
      scene.motion!.recipeId,
    );
    expect(
      motionFallbackReason(
        scene.motion!,
        scene.text,
        scene.chart,
        false,
        scene.items,
        scene.background,
      ),
    ).toBeUndefined();
    const html = buildHyperframesCompositionHtml({
      width: 540,
      height: 960,
      fps: 30,
      tokens: defaultBrandTokens,
      scenes: [scene],
      timeline: [{ sceneId: scene.id, startFrame: 0, durationFrames: 120 }],
    });
    expect(html).toContain(`data-motion-recipe="${scene.motion!.recipeId}"`);
    for (const item of scene.items ?? scene.chart?.labels ?? [])
      expect(html).toContain(item);
    expect(html).not.toContain("Math.random");
  }
});

it("escapes all user text, and rejects content a composition would hide", () => {
  const scene = {
    id: "copy",
    templateId: "hf-statement",
    text: '<script>"Copy" & meaning</script>',
    emphasis: [],
    motion: motionDirection("type-window"),
  };
  const html = buildHyperframesCompositionHtml({
    width: 540,
    height: 960,
    fps: 30,
    tokens: defaultBrandTokens,
    scenes: [scene],
    timeline: [{ sceneId: scene.id, startFrame: 0, durationFrames: 120 }],
  });
  expect(html).toContain(
    "&lt;script&gt;&quot;Copy&quot; &amp; meaning&lt;/script&gt;",
  );
  expect(html).not.toContain('<script>"Copy"');
  for (const id of [
    "quote-margin",
    "type-spread",
    "type-window",
    "type-poster",
  ] as const) {
    expect(
      motionFallbackReason(
        motionDirection(id),
        "Supplied copy",
        undefined,
        false,
        ["One", "Two"],
      ),
    ).toMatch(/hide/);
    expect(
      motionFallbackReason(
        motionDirection(id),
        "Supplied copy",
        undefined,
        false,
        undefined,
        { type: "image", url: "fixture.jpg" },
      ),
    ).toMatch(/hide/);
  }
  expect(
    motionFallbackReason(
      motionDirection("list-grid"),
      "Four ideas",
      undefined,
      false,
      ["a", "b", "c", "d", "e"],
    ),
  ).toMatch(/four|4/);
  expect(
    motionFallbackReason(
      motionDirection("list-cascade"),
      "Ideas",
      undefined,
      false,
      ["a", "b"],
      { type: "image", url: "image.jpg" },
    ),
  ).toMatch(/hide/);
  expect(
    motionFallbackReason(motionDirection("data-ledger"), "No numbers"),
  ).toMatch(/supplied/);
  expect(
    motionFallbackReason(motionDirection("data-ledger"), "Values", {
      labels: ["A", "B"],
      series: [{ label: "Count", values: [0, 0] }],
    }),
  ).toBeUndefined();
  expect(
    motionFallbackReason(
      motionDirection("media-mat"),
      "Footage",
      undefined,
      false,
      undefined,
      { type: "video", url: "video.mp4" },
    ),
  ).toMatch(/image/);
});
