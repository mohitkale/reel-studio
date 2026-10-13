import { directScene } from "../../src/production/director";
import type { ReelProps, ReelScene } from "../../src/video/types";
import {
  VISUAL_THEMES,
  applyVisualTheme,
} from "../../src/production/creative-direction";
import { defaultBrandTokens } from "../../src/video/tokens";

export function semanticGraphicsFixture(width = 540, height = 960): ReelProps {
  const definitions = [
    "SEO makes your content easier to discover in search results.",
    "AEO helps answer engines provide a direct answer.",
    "GEO is generative engine optimisation for visibility in AI-generated answers.",
    "Plants use sunlight to grow.",
    "An API connects your software to another service.",
  ].map((text, index): ReelScene => ({
    id: `definition-${index}`,
    order: index + 1,
    ...directScene(
      { text, emphasis: [], templateId: "hf-statement" },
      "explanation",
    ).scene,
  }));
  const scenes: ReelScene[] = [
    {
      id: "discovery-comparison",
      templateId: "hf-statement",
      order: 0,
      text: "SEO, AEO and GEO: three related approaches to discovery.",
      spokenText:
        "SEO is search engine optimisation. AEO is answer engine optimisation. GEO is generative engine optimisation.",
      emphasis: [],
      direction: {
        version: 1,
        role: "comparison",
        composition: "authored",
        graphic: {
          version: 1,
          kind: "comparison",
          nodes: [
            {
              label: "SEO",
              detail: "search engine optimisation",
              symbol: "search",
            },
            {
              label: "AEO",
              detail: "answer engine optimisation",
              symbol: "answer",
            },
            {
              label: "GEO",
              detail: "generative engine optimisation",
              symbol: "sources",
            },
          ],
        },
      },
    },
    {
      id: "discovery-overlap",
      templateId: "hf-statement",
      order: 1,
      text: "SEO, AEO and GEO have overlapping foundations.",
      emphasis: [],
      direction: {
        version: 1,
        role: "comparison",
        composition: "authored",
        graphic: {
          version: 1,
          kind: "comparison",
          relationship: "overlap",
          nodes: [
            { label: "SEO", symbol: "search" },
            { label: "AEO", symbol: "answer" },
            { label: "GEO", symbol: "none" },
          ],
        },
      },
    },
    ...definitions,
    {
      id: "production-flow",
      templateId: "hf-statement",
      order: 6,
      text: "First capture the idea, then review the script, finally export the video.",
      emphasis: [],
      direction: {
        version: 1,
        role: "diagram",
        composition: "authored",
        graphic: {
          version: 1,
          kind: "flow",
          nodes: [
            { label: "capture the idea", symbol: "idea" },
            { label: "review the script", symbol: "document" },
            { label: "export the video", symbol: "media" },
          ],
        },
      },
    },
  ];
  return {
    width,
    height,
    fps: 24,
    scenes,
    hideProgressBar: true,
    tokens: applyVisualTheme(defaultBrandTokens, VISUAL_THEMES.paper),
    timeline: scenes.map((scene, index) => ({
      sceneId: scene.id,
      startFrame: index * 144,
      durationFrames: 144,
    })),
  };
}
