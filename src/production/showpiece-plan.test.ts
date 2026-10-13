import { describe, expect, it } from "vitest";
import type { ReelScene } from "@/video/types";
import { SHOWPIECE_SAMPLES } from "@/video/showpiece-samples";
import { semanticGraphicSchema } from "@/video/semantic-graphic";
import {
  enrichSemanticSequence,
  inferSemanticGraphic,
  resolveSemanticGraphic,
  semanticStorySource,
} from "./semantic-direction";
import { showpieceSchedule, subjectLane } from "./showpiece-plan";
import { buildHyperframesCompositionHtml } from "@/engines/hyperframes/build-composition";
import { SHOWPIECE_BOOT } from "@/engines/hyperframes/motion/showpiece-blocks";
import { defaultBrandTokens } from "@/video/tokens";

const props = {
  scenes: SHOWPIECE_SAMPLES,
  timeline: SHOWPIECE_SAMPLES.map((scene, i) => ({
    sceneId: scene.id,
    startFrame: i * 240,
    durationFrames: 240,
  })),
  fps: 30,
  width: 1080,
  height: 1920,
  tokens: defaultBrandTokens,
};
describe("story showpieces", () => {
  it("automatically plans an organisation, routing architecture and supplied product stages without a user choosing graphics", () => {
    const inputs: ReelScene[] = SHOWPIECE_SAMPLES.slice(2).map((scene) => ({
      ...scene,
      direction: undefined,
    }));
    const directed = enrichSemanticSequence(inputs);
    expect(
      directed.map((scene) => scene.direction?.graphic?.presentation),
    ).toEqual([
      "branch-cascade",
      "signal-routing",
      "kinetic-handoff",
      "device-evolution",
    ]);
    expect(directed.map((scene) => [scene.text, scene.spokenText])).toEqual(
      inputs.map((scene) => [scene.text, scene.spokenText]),
    );
    expect(
      inferSemanticGraphic("CEO hires CTO, COO, CMO and CXO.")?.nodes.map(
        (node) => node.label,
      ),
    ).toEqual(["CEO", "CTO", "COO", "CMO", "CXO"]);
    expect(
      enrichSemanticSequence([{ ...inputs[0], locks: { scene: true } }])[0]
        .direction,
    ).toBeUndefined();
  });
  it("recognises natural narration and does not reduce a whole system to its first icon", () => {
    const inputs: ReelScene[] = [
      {
        ...SHOWPIECE_SAMPLES[2],
        text: "The CEO leads with key executives.",
        spokenText:
          "Your CEO sets the vision, supported by a CTO, COO, CMO, and CXO.",
        direction: undefined,
      },
      {
        ...SHOWPIECE_SAMPLES[3],
        text: "APIs connect your app's components.",
        spokenText:
          "An API acts as the bridge, connecting your phone app, website, database, and cloud services.",
        direction: undefined,
      },
      {
        ...SHOWPIECE_SAMPLES[5],
        text: "The app evolves: Wireframe to Launch.",
        spokenText:
          "This simulated app evolves from a basic wireframe, to an interactive prototype, and finally to a full launch.",
        direction: undefined,
      },
    ];
    const directed = enrichSemanticSequence(inputs);
    expect(
      directed.map((scene) => scene.direction?.graphic?.presentation),
    ).toEqual(["branch-cascade", "signal-routing", "device-evolution"]);
    expect(
      directed[0].direction?.graphic?.nodes.map((node) => node.label),
    ).toEqual(["CEO", "CTO", "COO", "CMO", "CXO"]);
    expect(inferSemanticGraphic(inputs[0].spokenText!)?.kind).toBe("hierarchy");
    expect(
      resolveSemanticGraphic({
        ...SHOWPIECE_SAMPLES[2],
        text: "A CEO and CTO join as peers. SuperCEO hires CTO.",
        spokenText: undefined,
        direction: {
          ...SHOWPIECE_SAMPLES[2].direction!,
          graphic: {
            ...SHOWPIECE_SAMPLES[2].direction!.graphic!,
            nodes: SHOWPIECE_SAMPLES[2].direction!.graphic!.nodes.slice(0, 2),
          },
        },
      }),
    ).toBeUndefined();
    expect(
      directed[2].direction?.graphic?.nodes.map((node) => node.label),
    ).toEqual(["basic wireframe", "interactive prototype", "full launch"]);
    const graph = SHOWPIECE_SAMPLES[2].direction!.graphic!;
    expect(
      resolveSemanticGraphic(
        {
          ...SHOWPIECE_SAMPLES[2],
          direction: {
            ...SHOWPIECE_SAMPLES[2].direction!,
            graphic: {
              ...graph,
              nodes: graph.nodes.map((node, i) => ({
                ...node,
                ...(i === 2 ? { parent: 1 } : {}),
              })),
            },
          },
        },
        semanticStorySource(SHOWPIECE_SAMPLES),
      ),
    ).toBeUndefined();
  });
  it("admits six different storytelling jobs and rejects wrong structure, invented labels and cyclic parents", () => {
    const source = semanticStorySource(SHOWPIECE_SAMPLES);
    for (const scene of SHOWPIECE_SAMPLES)
      expect(resolveSemanticGraphic(scene, source)).toEqual(
        scene.direction!.graphic,
      );
    const hierarchy = SHOWPIECE_SAMPLES[2].direction!.graphic!;
    expect(
      semanticGraphicSchema.safeParse({
        ...hierarchy,
        nodes: [
          ...hierarchy.nodes.slice(0, 1),
          { ...hierarchy.nodes[1], parent: 1 },
        ],
      }).success,
    ).toBe(false);
    expect(
      resolveSemanticGraphic(
        {
          ...SHOWPIECE_SAMPLES[0],
          direction: {
            ...SHOWPIECE_SAMPLES[0].direction!,
            graphic: {
              ...SHOWPIECE_SAMPLES[0].direction!.graphic!,
              presentation: "branch-cascade",
            },
          },
        },
        source,
      ),
    ).toBeUndefined();
    expect(
      resolveSemanticGraphic(
        { ...SHOWPIECE_SAMPLES[2], spokenText: "An unrelated organisation." },
        source,
      ),
    ).toBeUndefined();
  });
  it("uses measured subject words after retiming, and preserves stable identity lanes", () => {
    const graphic = SHOWPIECE_SAMPLES[4].direction!.graphic!;
    const schedule = showpieceSchedule(graphic, 8, 30, 120, [
      { text: "Designer", startFrame: 150, endFrame: 170 },
      { text: "Reviewer", startFrame: 240, endFrame: 260 },
      { text: "DevOps", startFrame: 300, endFrame: 320 },
    ]);
    expect(schedule.arrivals).toEqual([1, 4, 6]);
    expect(
      showpieceSchedule(graphic, 10, 60, 240, [
        { text: "Designer", startFrame: 330, endFrame: 350 },
        { text: "Reviewer", startFrame: 540, endFrame: 580 },
        { text: "DevOps", startFrame: 690, endFrame: 730 },
      ]).arrivals,
    ).toEqual([1.5, 5, 7.5]);
    expect(subjectLane("CTO")).toBe(subjectLane("cto"));
  });
  it("keeps frozen basic illustrations on their original path while new showpieces have deterministic choreography and disclosure", () => {
    const html = buildHyperframesCompositionHtml(props);
    expect(html.match(/<div[^>]+data-showpiece=/g)).toHaveLength(6);
    for (const scene of SHOWPIECE_SAMPLES) expect(html).toContain(scene.text);
    expect(html).toContain("Illustrative");
    const comparison = buildHyperframesCompositionHtml({
      ...props,
      scenes: [SHOWPIECE_SAMPLES[1]],
      timeline: [{ ...props.timeline[0], sceneId: SHOWPIECE_SAMPLES[1].id }],
    });
    expect(comparison).not.toContain('class="sp-wire"');
    expect(comparison).not.toContain('class="sp-packet"');
    expect(SHOWPIECE_BOOT).not.toMatch(
      /Math\.random\(|Date\.now\(|performance\.now\(/,
    );
    const graphic = SHOWPIECE_SAMPLES[0].direction!.graphic!;
    const old = {
      ...SHOWPIECE_SAMPLES[0],
      direction: {
        ...SHOWPIECE_SAMPLES[0].direction!,
        graphic: { ...graphic, presentation: undefined },
      },
    };
    const legacy = buildHyperframesCompositionHtml({
      ...props,
      scenes: [old],
      timeline: [props.timeline[0]],
    });
    expect(legacy).toContain('data-semantic-block="concept"');
    expect(legacy).not.toMatch(/<div[^>]+data-showpiece=/);
  });
});
