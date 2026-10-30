import { expect, it } from "vitest";
import { evidenceFixture } from "./fixtures";
import {
  creationEvidenceSources,
  unsupportedCreationNumbers,
} from "./creation-grounding";
import { scenePlanSchema } from "@/providers/ai/types";

it("excludes disputed evidence and detects unsupported numeric narration", () => {
  const evidence = evidenceFixture();
  evidence.sources[0]!.excerpts[0]!.text = "The figure was 42%.";
  evidence.sources[0]!.excerpts.push({
    id: "excerpt-2",
    text: "The figure was 91%.",
    kind: "source_text",
  });
  evidence.claims.push({
    id: "claim-2",
    text: "The figure was 91%.",
    references: [{ sourceId: "source-1", excerptId: "excerpt-2" }],
  });
  evidence.conflicts.push({
    id: "conflict-1",
    description: "Figures differ",
    claimIds: ["claim-1", "claim-2"],
  });
  const sources = creationEvidenceSources(evidence);
  expect(sources).toEqual([]);
  const plan = scenePlanSchema.parse({
    projectName: "Results",
    scriptName: "Results",
    scenes: [
      {
        templateId: "hf-statement",
        text: "Results were 42%",
        spokenText: "Results were 42% in 2025",
        emphasis: [],
      },
    ],
  });
  expect(
    unsupportedCreationNumbers(plan, ["Results: 42%", ...sources]),
  ).toEqual(["2025"]);
  expect(unsupportedCreationNumbers(plan, ["Results: 42% in 2025"])).toEqual(
    [],
  );
});
