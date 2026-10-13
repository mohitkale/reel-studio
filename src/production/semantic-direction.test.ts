import { describe, expect, it } from "vitest";
import { directScene } from "./director";
import {
  inferSemanticGraphic,
  resolveSemanticGraphic,
  semanticGraphicIssue,
  enrichSemanticSequence,
  semanticStorySource,
} from "./semantic-direction";
import { semanticGraphicSchema } from "@/video/semantic-graphic";
import { shotDirectionSchema } from "@/video/shot-direction";
import { planMotionSequence } from "./motion-plan";
import { buildHyperframesCompositionHtml } from "@/engines/hyperframes/build-composition";
import { semanticGraphicsFixture } from "../../tests/fixtures/semantic-graphics";

describe("content-led visual grammar", () => {
  it("extracts an explicit named definition from longer narration without losing the subject", () => {
    expect(
      inferSemanticGraphic(
        "GEO: AI-Powered Content",
        "GEO, Generative Engine Optimisation, is about optimising your content for AI-driven search experiences that generate new responses.",
      ),
    ).toMatchObject({
      kind: "concept",
      nodes: [
        {
          label: "GEO",
          symbol: "sources",
          detail: "Generative Engine Optimisation",
        },
      ],
    });
  });
  it("builds a coherent multi-subject overview from real definitions elsewhere in the story", () => {
    const props = semanticGraphicsFixture();
    const original = structuredClone(props.scenes);
    const inputs = [
      {
        ...props.scenes[0],
        text: "GEO, AEO, SEO: where do they fit?",
        spokenText: undefined,
      },
      ...props.scenes.slice(1),
    ];
    const planned = enrichSemanticSequence(inputs);
    const graphic = planned[0].direction!.graphic!;
    expect(graphic.kind).toBe("comparison");
    expect(graphic.nodes.map((node) => [node.label, node.symbol])).toEqual([
      ["GEO", "sources"],
      ["AEO", "answer"],
      ["SEO", "search"],
    ]);
    expect(
      resolveSemanticGraphic(planned[0], semanticStorySource(planned)),
    ).toEqual(graphic);
    expect(
      resolveSemanticGraphic(planned[0], "Unrelated definitions"),
    ).toBeUndefined();
    expect(props.scenes).toEqual(original);
    expect(enrichSemanticSequence(planned)).toEqual(planned);
    // Appending an overview can reuse existing definitions without editing them.
    const appended = enrichSemanticSequence(inputs.slice(0, 1), inputs);
    expect(appended[0].direction?.graphic).toEqual(graphic);
    expect(appended).toHaveLength(1);
  });
  it("automatically illustrates actual subjects across content types rather than rotating decoration", () => {
    const props = semanticGraphicsFixture();
    expect(
      props.scenes.map(
        (scene) =>
          resolveSemanticGraphic(scene, semanticStorySource(props.scenes))
            ?.kind,
      ),
    ).toEqual([
      "comparison",
      "comparison",
      ...Array(5).fill("concept"),
      "flow",
    ]);
    expect(
      props.scenes
        .slice(2, 7)
        .map((scene) => resolveSemanticGraphic(scene)?.nodes[0].symbol),
    ).toEqual(["search", "answer", "sources", "growth", "code"]);
    expect(inferSemanticGraphic("Think of it like this:")).toBeUndefined();
    expect(
      inferSemanticGraphic(
        "SEO. AEO. GEO. What do they mean for your business?",
      ),
    ).toBeUndefined();
    expect(
      inferSemanticGraphic("Every idea deserves enough reading space."),
    ).toBeUndefined();
  });
  it("rejects invented, stale and unrelated subjects, unsupported arrows and reordered steps", () => {
    const flow = semanticGraphicsFixture().scenes.at(-1)!.direction!.graphic!;
    expect(
      semanticGraphicIssue(
        flow,
        "First capture the idea, then review the script, finally export the video.",
      ),
    ).toBeUndefined();
    expect(
      semanticGraphicIssue(
        { ...flow, nodes: [...flow.nodes].reverse() },
        "First capture the idea, then review the script, finally export the video.",
      ),
    ).toMatch(/order/);
    expect(
      semanticGraphicIssue(
        flow,
        "capture the idea, review the script, export the video",
      ),
    ).toMatch(/explicit order/);
    expect(
      semanticGraphicIssue(
        {
          version: 1,
          kind: "concept",
          nodes: [{ label: "Revenue", symbol: "search" }],
        },
        "Revenue is supplied here.",
      ),
    ).toMatch(/matches/);
    expect(
      semanticGraphicIssue(
        {
          version: 1,
          kind: "concept",
          nodes: [{ label: "art", symbol: "idea" }],
        },
        "Cartography is an idea.",
      ),
    ).toMatch(/labels/);
    expect(
      resolveSemanticGraphic({
        ...semanticGraphicsFixture().scenes[1],
        text: "A different subject",
        spokenText: undefined,
      }),
    ).toBeUndefined();
  });
  it("keeps media, data, explicit items and locks authoritative through family changes", () => {
    const scene = semanticGraphicsFixture().scenes[2];
    for (const extra of [
      { visual: "Existing visual" },
      { items: ["Existing item"] },
      { chart: {} },
      { background: { url: "supplied.png" } },
    ])
      expect(resolveSemanticGraphic({ ...scene, ...extra })).toBeUndefined();
    for (const system of ["editorial", "poster", "precision"] as const)
      expect(
        planMotionSequence([scene], {
          version: "1.0.0",
          ambition: "showcase",
          system,
          seed: "fixed",
        }),
      ).toEqual([undefined]);
    const current = {
      recipeId: "type-editorial" as const,
      version: "1.0.0" as const,
    };
    expect(
      planMotionSequence([{ ...scene, current, locked: true }], {
        version: "1.0.0",
        ambition: "showcase",
        system: "poster",
        seed: "fixed",
      }),
    ).toEqual([current]);
  });
  it("adopts a valid AI comparison without manufacturing list items or overwriting explicit inputs", () => {
    const scene = semanticGraphicsFixture().scenes[0];
    const directed = directScene(
      { ...scene, templateId: "hf-statement" },
      "explanation",
    );
    expect(directed.direction.graphic).toEqual(scene.direction!.graphic);
    expect(directed.scene.items).toBeUndefined();
    expect(
      directScene(
        { ...scene, templateId: "hf-list", items: ["Existing"] },
        "diagram",
      ).direction.graphic,
    ).toBeUndefined();
  });
  it("drops malformed optional AI art while retaining useful copy and the bounded legacy direction", () => {
    expect(
      semanticGraphicSchema.safeParse({
        version: 1,
        kind: "html",
        nodes: [],
        code: "<script>",
      }).success,
    ).toBe(false);
    expect(
      shotDirectionSchema.parse({
        version: 1,
        role: "explanation",
        composition: "authored",
        graphic: { kind: "html", code: "<script>" },
      }),
    ).toEqual({ version: 1, role: "explanation", composition: "authored" });
  });
  it("renders source-specific subjects and complete narration labels through the production compiler", () => {
    const html = buildHyperframesCompositionHtml(semanticGraphicsFixture());
    for (const word of [
      "search engine optimisation",
      "answer engine optimisation",
      "generative engine optimisation",
      "capture the idea",
      "review the script",
      "export the video",
    ])
      expect(html).toContain(word);
    expect(html).toContain('data-semantic-block="comparison"');
    expect(html).toContain('data-symbol="growth"');
    expect(html).not.toContain('data-motion-recipe="type-spread"');
    // A full explanation is shown once; it is not repeated below the illustration.
    expect(html).not.toContain('class="sg-detail">makes your content');
  });
});
