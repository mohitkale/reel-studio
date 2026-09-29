import { describe, expect, it } from "vitest";

import {
  chooseTypeMotion,
  motionDirection,
  motionDirectionSchema,
  resolveMotionDirection,
} from "@/production/motion";

describe("type motion direction", () => {
  it("chooses a readable recipe from the scene's role and copy", () => {
    const hook = chooseTypeMotion({ role: "hook", text: "A sharper opening." });
    expect(hook).toEqual(motionDirection("type-impact"));
    expect(
      chooseTypeMotion({ role: "headline", text: "A quieter opening." }),
    ).toEqual(motionDirection("type-editorial"));
    expect(
      chooseTypeMotion({ role: "chart", text: "Real values" }),
    ).toBeUndefined();
    expect(
      chooseTypeMotion({
        role: "hook",
        text: "Keep the supplied screenshot visible.",
        hasVisualContent: true,
      }),
    ).toBeUndefined();
    expect(
      chooseTypeMotion({
        role: "hook",
        text: "A sharper opening.",
        previous: hook,
      }),
    ).toEqual(motionDirection("type-editorial"));
  });

  it("keeps saved selections versioned and falls back when copy outgrows them", () => {
    expect(
      motionDirectionSchema.safeParse(motionDirection("type-impact")).success,
    ).toBe(true);
    expect(
      motionDirectionSchema.safeParse({
        recipeId: "type-impact",
        version: "9.0.0",
      }).success,
    ).toBe(false);
    expect(
      resolveMotionDirection(motionDirection("type-impact"), "x".repeat(121)),
    ).toBeUndefined();
    expect(
      resolveMotionDirection(
        motionDirection("type-editorial"),
        "x".repeat(121),
      ),
    ).toEqual(motionDirection("type-editorial"));
  });
});
