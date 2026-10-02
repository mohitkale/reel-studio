import { describe, expect, it } from "vitest";
import {
  MOTION_RECIPES,
  motionDirection,
  motionFallbackReason,
} from "@/production/motion";
import { motionLibraryFixture } from "../../tests/fixtures/motion-library";
import { buildHyperframesCompositionHtml } from "@/engines/hyperframes/build-composition";

describe("authored motion library", () => {
  it("compiles all fifteen validated blocks without falling back or making up data", () => {
    const props = motionLibraryFixture();
    expect(MOTION_RECIPES).toHaveLength(15);
    for (const scene of props.scenes)
      expect(
        motionFallbackReason(
          scene.motion!,
          scene.text,
          scene.chart,
          Boolean(scene.visual),
          scene.items,
          scene.background,
        ),
        scene.id,
      ).toBeUndefined();
    for (const [width, height] of [
      [540, 960],
      [960, 540],
    ]) {
      const html = buildHyperframesCompositionHtml({ ...props, width, height });
      for (const recipe of MOTION_RECIPES)
        expect(html).toContain(`data-motion-recipe="${recipe.id}"`);
      expect(html.match(/class="ml-ambient"/g)).toHaveLength(15);
      expect(html).toContain("72%");
      expect(html).toContain("Synthetic verification data");
      expect(html).toContain("--brand-foreground:");
      expect(html).not.toContain("repeat: -1");
    }
  });
  it("rejects unsupplied charts and overly long word stacks", () => {
    expect(
      motionFallbackReason(motionDirection("data-bars"), "No supplied values"),
    ).toMatch(/supplied/);
    expect(
      motionFallbackReason(
        motionDirection("type-stack"),
        "one two three four five six seven eight nine",
      ),
    ).toMatch(/eight/);
    expect(motionFallbackReason(motionDirection("type-stack"), "")).toMatch(
      /eight/,
    );
  });
});
