import { describe, expect, it } from "vitest";

import { lintStoryboard } from "@/storyboard/lint";
import { SCENE_TYPES } from "@/storyboard";
import { planFromStoryboard } from "@/production/storyboard-plan";
import { storyboardToReelProps } from "@/production/storyboard-reel";
import { buildHyperframesCompositionHtml } from "@/engines/hyperframes/build-composition";
import {
  HF_TEMPLATES,
  normalizeHfTemplateId,
} from "@/engines/hyperframes/templates";
import { sceneLibrary } from "./library";
import { SCENE_DEFINITIONS, sceneDefinitionForTemplate } from "./registry";

/** One storyboard that uses every registered type with its sample content. */
function tour(): unknown {
  const panelToFields: Record<string, (p: Record<string, unknown>) => object> =
    {
      steps: (p) => ({ items: p.items }),
      checklist: (p) => ({ items: p.items }),
      comparison: (p) => ({ compare: { left: p.left, right: p.right } }),
      "before-after": (p) => ({ compare: { left: p.left, right: p.right } }),
      timeline: (p) => ({ points: p.points }),
      diagram: (p) => ({ points: p.points }),
      definition: (p) => ({ definition: p }),
      terminal: (p) => ({
        code: { language: "bash", text: (p.lines as string[]).join("\n") },
      }),
      "media-split": () => ({ media: { query: "person editing video" } }),
      "device-mockup": (p) => ({ body: p.screen }),
    };
  return {
    version: 1,
    title: "Scene types",
    format: "9:16",
    scenes: [
      {
        type: "hook",
        headline: "Twenty ways to say it",
        narration: "A tour of every scene type the studio can draw.",
      },
      ...SCENE_DEFINITIONS.map((definition) => ({
        type: definition.id,
        headline: definition.sample.headline,
        narration: definition.sample.narration,
        ...(definition.sample.emphasis
          ? { emphasis: definition.sample.emphasis }
          : {}),
        ...(panelToFields[definition.id]?.(
          definition.sample.payload as Record<string, unknown>,
        ) ?? {}),
      })),
      {
        type: "cta",
        headline: "Pick your scenes",
        narration:
          "Pick the scenes that fit your story and let the studio draw them.",
      },
    ],
  };
}

describe("scene registry", () => {
  it("registers every non-core scene type once, with a template the engine knows", () => {
    const ids = SCENE_DEFINITIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const definition of SCENE_DEFINITIONS) {
      expect(SCENE_TYPES).toContain(definition.id);
      expect(HF_TEMPLATES.some((t) => t.id === definition.templateId)).toBe(
        true,
      );
      expect(normalizeHfTemplateId(definition.templateId)).toBe(
        definition.templateId,
      );
      expect(sceneDefinitionForTemplate(definition.templateId)).toBe(
        definition,
      );
    }
  });

  it("offers twenty scene types in the library", () => {
    expect(
      sceneLibrary()
        .map((e) => e.type)
        .sort(),
    ).toEqual([...SCENE_TYPES].sort());
    expect(sceneLibrary()).toHaveLength(20);
  });

  it("validates every sample against its own schema", () => {
    for (const definition of SCENE_DEFINITIONS) {
      expect(
        definition.schema.safeParse(definition.sample.payload).success,
      ).toBe(true);
    }
  });

  it("lints the tour without repairs, plans it and draws every type", () => {
    const result = lintStoryboard(tour());
    expect(result.errors).toEqual([]);
    expect(result.fixes).toEqual([]);
    const storyboard = result.storyboard!;
    const plan = planFromStoryboard(storyboard);
    expect(plan.scenes.map((s) => s.templateId)).toEqual(
      storyboard.kind === "video"
        ? storyboard.scenes.map(
            (s) => plan.scenes[storyboard.scenes.indexOf(s)]!.templateId,
          )
        : [],
    );
    const { props } = storyboardToReelProps(storyboard);
    const html = buildHyperframesCompositionHtml(props);
    for (const definition of SCENE_DEFINITIONS) {
      expect(html).toContain(`fx-dialogue fx-dlg-${definition.id}`);
    }
  });

  it("falls back to a statement when a scene's data is missing or wrong", () => {
    const { props } = storyboardToReelProps(
      lintStoryboard({
        version: 1,
        title: "Fallback",
        format: "9:16",
        scenes: [
          {
            type: "statement",
            headline: "One idea",
            narration: "One idea, said plainly for everyone.",
          },
        ],
      }).storyboard!,
    );
    const broken = {
      ...props,
      scenes: [
        {
          ...props.scenes[0]!,
          templateId: "hf-steps",
          panel: { items: "nope" },
        },
      ],
    };
    const html = buildHyperframesCompositionHtml(broken);
    expect(html).not.toContain("fx-dialogue fx-dlg-steps");
    expect(html).toContain("fx-dlg-statement");
  });
});
