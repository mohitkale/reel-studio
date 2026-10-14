import type { ReelScene } from "../../src/video/types";
export const SHOWPIECE_STRESS: ReelScene = {
  id: "showpiece-hierarchy-depth",
  templateId: "hf-statement",
  order: 6,
  emphasis: [],
  text: "Teams grow through real relationships.",
  spokenText:
    "CEO hires CTO, COO and CMO. CTO hires Designer and Reviewer. COO hires DevOps. CMO hires Sales.",
  direction: {
    version: 1,
    role: "diagram",
    composition: "authored",
    graphic: {
      version: 1,
      kind: "hierarchy",
      presentation: "branch-cascade",
      nodes: [
        { label: "CEO", symbol: "person" },
        { label: "CTO", symbol: "person", parent: 0 },
        { label: "COO", symbol: "person", parent: 0 },
        { label: "CMO", symbol: "person", parent: 0 },
        { label: "Designer", symbol: "person", parent: 1 },
        { label: "Reviewer", symbol: "person", parent: 1 },
        { label: "DevOps", symbol: "person", parent: 2 },
        { label: "Sales", symbol: "none", parent: 3 },
      ],
    },
  },
};
