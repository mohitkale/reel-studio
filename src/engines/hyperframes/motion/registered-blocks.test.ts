import { expect, it } from "vitest";
import { EXTENSION_MOTION_RECIPES } from "@/video/motion-extensions";
import { defaultBrandTokens } from "@/video/tokens";
import {
  motionDirection,
  motionRecipeIdSchema,
  chooseSceneMotion,
  motionFallbackReason,
} from "@/production/motion";
import { buildHyperframesCompositionHtml } from "../build-composition";
import { REGISTERED_MOTION_BLOCKS } from "./registered-blocks";

it("derives extension IDs, dispatches the real block and preserves escaped supplied copy", () => {
  expect(REGISTERED_MOTION_BLOCKS.map((block) => block.recipe.id)).toEqual(
    EXTENSION_MOTION_RECIPES.map((recipe) => recipe.id),
  );
  for (const recipe of EXTENSION_MOTION_RECIPES) {
    expect(motionRecipeIdSchema.parse(recipe.id)).toBe(recipe.id);
    expect(
      chooseSceneMotion({ role: "quote", text: "Supplied quotation" })
        ?.recipeId,
    ).toBe(recipe.id);
    const scene = {
      id: "quote",
      templateId: "hf-quote",
      text: '<script>"Copy" & meaning</script>',
      emphasis: [],
      motion: motionDirection(recipe.id),
    };
    const html = buildHyperframesCompositionHtml({
      width: 540,
      height: 960,
      fps: 30,
      tokens: defaultBrandTokens,
      scenes: [scene],
      timeline: [{ sceneId: scene.id, startFrame: 0, durationFrames: 120 }],
    });
    expect(html).toContain(`data-motion-recipe="${recipe.id}"`);
    expect(html).toContain(".qm-stage");
    expect(html).toContain(
      "&lt;script&gt;&quot;Copy&quot; &amp; meaning&lt;/script&gt;",
    );
    expect(html).not.toContain('<script>"Copy"');
    expect(
      motionFallbackReason(scene.motion, "Supplied copy", undefined, false, [
        "One",
        "Two",
      ]),
    ).toMatch(/hide/);
    expect(
      motionFallbackReason(
        scene.motion,
        "Supplied copy",
        undefined,
        false,
        undefined,
        { type: "image", url: "fixture.jpg" },
      ),
    ).toMatch(/hide/);
  }
});
