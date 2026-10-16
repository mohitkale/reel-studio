import { describe, it, expect } from "vitest";
import { ADAPTIVE_RECIPES, ADAPTIVE_MANIFESTS } from "@/video/adaptive-catalog";
import { ADAPTIVE_SAMPLES } from "@/video/adaptive-samples";
import { adaptiveLayoutSchema } from "@/video/adaptive-layout";
import { resolveAdaptiveLayout, adaptiveInputReason } from "./adaptive-layout";
import { buildHyperframesCompositionHtml } from "@/engines/hyperframes/build-composition";
import { defaultBrandTokens } from "@/video/tokens";
import { planMotionSequence } from "./motion-plan";
import { filmSnapshot } from "../../tests/fixtures/film-plan";
import { withResolvedFilmPlan, filmPlanMatchesSource } from "./film-plan";

describe("M2 adaptive recipes", () => {
  it.each([
    [1080, 1920],
    [1920, 1080],
    [1080, 1080],
  ])(
    "resolves all six recipes within %sx%s safe areas at short and long timings",
    (width, height) => {
      for (const sample of ADAPTIVE_SAMPLES)
        for (const system of ["editorial", "precision", "poster"] as const)
          for (const seconds of [1, 4, 12, 120]) {
            const scene = { ...sample, motion: { ...sample.motion!, system } };
            const result = resolveAdaptiveLayout(scene, width, height, seconds);
            expect(
              result.reason,
              `${sample.id} ${width} ${seconds}`,
            ).toBeUndefined();
            const plan = adaptiveLayoutSchema.parse(result.plan);
            for (const box of [
              plan.headline,
              ...plan.panels,
              ...(plan.source ? [plan.source] : []),
            ]) {
              expect(box.x).toBeGreaterThanOrEqual(0);
              expect(box.y).toBeGreaterThanOrEqual(0);
              expect(box.x + box.width).toBeLessThanOrEqual(width);
              expect(box.y + box.height).toBeLessThanOrEqual(height);
            }
            for (const panel of plan.panels) {
              expect(panel.at + plan.entrance).toBeLessThan(seconds);
              expect(panel.focus + seconds * 0.08).toBeLessThan(seconds);
            }
            expect(
              resolveAdaptiveLayout(scene, width, height, seconds),
            ).toEqual(result);
          }
    },
  );
  it("reflows the same comparison and media content rather than shrinking a portrait canvas", () => {
    for (const scene of [ADAPTIVE_SAMPLES[1], ADAPTIVE_SAMPLES[4]]) {
      expect(
        resolveAdaptiveLayout(scene, 1080, 1920, 8).plan!.variant,
      ).not.toBe(resolveAdaptiveLayout(scene, 1920, 1080, 8).plan!.variant);
    }
  });
  it("preserves complete text, exact numbers, attribution and input order in compiled HTML", () => {
    for (const scene of ADAPTIVE_SAMPLES) {
      const html = buildHyperframesCompositionHtml({
        width: 1080,
        height: 1920,
        fps: 30,
        scenes: [scene],
        timeline: [{ sceneId: scene.id, startFrame: 0, durationFrames: 240 }],
        tokens: defaultBrandTokens,
      });
      expect(html).toContain(`data-recipe="${scene.motion!.recipeId}"`);
      expect(html).toContain(scene.text);
      for (const item of scene.items ?? []) expect(html).toContain(item);
      if (scene.chart) {
        expect(html).toContain(scene.chart.sourceAttribution);
        for (const n of scene.chart.series[0].values)
          expect(html).toContain(String(n));
      }
    }
  });
  it("rejects missing inputs, extra data, hidden text, wrong media and overlong copy without mutating the source", () => {
    const cases = [
      { ...ADAPTIVE_SAMPLES[4], background: undefined },
      { ...ADAPTIVE_SAMPLES[1], items: ["One"] },
      { ...ADAPTIVE_SAMPLES[3], chart: undefined },
      { ...ADAPTIVE_SAMPLES[0], items: ["Do not lose this"] },
      { ...ADAPTIVE_SAMPLES[0], hideText: true },
      {
        ...ADAPTIVE_SAMPLES[4],
        background: { type: "video" as const, url: "/clip.mp4" },
      },
      { ...ADAPTIVE_SAMPLES[0], text: "x".repeat(261) },
    ];
    for (const scene of cases) {
      const before = structuredClone(scene);
      expect(resolveAdaptiveLayout(scene, 1080, 1920, 8).reason).toBeTruthy();
      expect(scene).toEqual(before);
    }
  });
  it("supports maximum subject counts and adapts dense copy or returns an explicit fallback", () => {
    for (const [index, count] of [
      [1, 4],
      [2, 6],
      [3, 6],
    ]) {
      const scene = structuredClone(ADAPTIVE_SAMPLES[index]);
      if (scene.items)
        scene.items = Array.from(
          { length: count },
          (_, i) => `Supplied item ${i + 1}`,
        );
      if (scene.chart) {
        scene.chart.labels = Array.from(
          { length: count },
          (_, i) => `Label ${i + 1}`,
        );
        scene.chart.series[0].values = Array.from(
          { length: count },
          (_, i) => i * 10,
        );
      }
      for (const [width, height] of [
        [1080, 1920],
        [1920, 1080],
        [1080, 1080],
      ]) {
        expect(
          resolveAdaptiveLayout(scene, width, height, 12).plan?.panels,
          `${scene.id} maximum subjects ${width}x${height}`,
        ).toHaveLength(count);
      }
      const dense = {
        ...scene,
        text: "A supplied explanation that keeps all of the original words visible while the design adapts to the amount of information in the scene.",
      };
      const result = resolveAdaptiveLayout(dense, 1920, 1080, 12);
      expect(result.plan?.panels, `${scene.id} dense headline`).toHaveLength(
        count,
      );
    }
  });
  it("changes density strategy and explicitly rejects labels that cannot fit", () => {
    expect(
      resolveAdaptiveLayout(ADAPTIVE_SAMPLES[1], 1080, 1080, 8).plan?.variant,
    ).toBe("stack");
    const sparse = {
      ...ADAPTIVE_SAMPLES[1],
      items: ["One", "Two", "Three", "Four"],
    };
    expect(resolveAdaptiveLayout(sparse, 1080, 1920, 8).plan?.variant).toBe(
      "grid",
    );
    const dense = {
      ...sparse,
      items: Array(4).fill(
        "Complete supplied alternative with extra explanatory context",
      ),
    };
    expect(resolveAdaptiveLayout(dense, 1080, 1920, 8).plan?.variant).toBe(
      "stack",
    );
    const impossible = {
      ...ADAPTIVE_SAMPLES[2],
      items: Array(6).fill("界".repeat(96)),
    };
    expect(resolveAdaptiveLayout(impossible, 1080, 1920, 8)).toMatchObject({
      reason: expect.stringContaining("more space"),
    });
    expect(
      resolveAdaptiveLayout(
        { ...ADAPTIVE_SAMPLES[0], text: "Line\n".repeat(50) },
        1920,
        1080,
        8,
      ).reason,
    ).toContain("headline needs more space");
    const short = resolveAdaptiveLayout(
      ADAPTIVE_SAMPLES[2],
      1080,
      1920,
      1,
    ).plan!;
    expect(short.panels.every((p) => p.at === 0 && p.focus === 0)).toBe(true);
    expect(short.warnings.length).toBeGreaterThan(0);
  });
  it("freezes adaptive geometry and manifest hashes while validating source bindings", () => {
    const snapshot = filmSnapshot();
    snapshot.script.scenes = [
      {
        ...snapshot.script.scenes[0],
        ...ADAPTIVE_SAMPLES[1],
        spokenText: null,
        hideText: false,
      },
    ];
    const resolved = withResolvedFilmPlan(snapshot);
    expect(resolved.filmPlan!.mode).toBe("adaptive");
    expect(resolved.filmPlan!.resolverVersion).toBe("1.1.0");
    expect(resolved.filmPlan!.shots[0].adaptive?.panels).toHaveLength(3);
    expect(filmPlanMatchesSource(resolved)).toBe(true);
    resolved.filmPlan!.shots[0].adaptive!.panels[0].x++;
    expect(filmPlanMatchesSource(resolved)).toBe(false);
  });
  it("uses the same admitted recipes in opt-in planning and protects locks and unstructured lists", () => {
    const scenes = ADAPTIVE_SAMPLES.map((s) => ({ ...s, current: s.motion }));
    const settings = {
      version: "1.0.0" as const,
      seed: "m2",
      ambition: "expressive" as const,
      system: "editorial" as const,
      adaptiveRecipes: true,
    };
    const planned = planMotionSequence(scenes, settings);
    expect(planned[1]?.recipeId).toBe("adaptive-comparison");
    expect(planned[2]?.recipeId).toBe("adaptive-process");
    const locked = planMotionSequence(
      [
        {
          ...scenes[0],
          locked: true,
          current: { recipeId: "type-window", version: "1.0.0" },
        },
      ],
      settings,
    );
    expect(locked[0]?.recipeId).toBe("type-window");
    expect(
      planMotionSequence([{ ...scenes[2], role: "feature" }], settings)[0]
        ?.recipeId,
    ).not.toBe("adaptive-process");
  });
  it("declares six versioned data-only manifests and a meaningful fallback", () => {
    expect(ADAPTIVE_MANIFESTS).toHaveLength(6);
    for (const [i, m] of ADAPTIVE_MANIFESTS.entries()) {
      expect(m.fallback[0].id).toBe("saved-scene");
      expect(m.provenance.license).toBe("MIT");
      expect(
        adaptiveInputReason(ADAPTIVE_RECIPES[i].id, ADAPTIVE_SAMPLES[i]),
      ).toBeUndefined();
    }
  });
});
