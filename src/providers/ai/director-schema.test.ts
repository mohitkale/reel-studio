import { expect, it } from "vitest";
import { buildOpenAIVideoPlanJsonSchema } from "./openai-compatible-schemas";
import { scenePlanSchema } from "./types";
import { strictLocalScenePlanSchema } from "./local-structured-schemas";

it("uses required nullable fields at every nested strict-output object", () => {
  const schema = buildOpenAIVideoPlanJsonSchema({
    mode: "story",
    brief: "Alpha: 42%; Beta: 57%",
  });
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const node = value as Record<string, unknown>;
    if (node.type === "object") {
      expect(node.additionalProperties).toBe(false);
      expect(node.required).toEqual(Object.keys(node.properties as object));
    }
    Object.values(node).forEach(visit);
  };
  visit(schema.schema);
});
it("admits the same nullable direction through frontier and strict local validation", () => {
  const output = {
    projectName: "Plan",
    scriptName: "Source",
    styleId: "clean-story",
    energy: "calm",
    scenes: [
      {
        capabilityId: "hf.template.statement",
        text: "A supplied idea",
        emphasis: [],
        visual: null,
        items: null,
        chart: null,
        spokenText: null,
        direction: {
          version: 1,
          role: "headline",
          composition: "layered-title",
          motion: null,
        },
      },
    ],
  };
  const local = strictLocalScenePlanSchema.parse(output);
  expect(scenePlanSchema.parse(local).scenes[0].direction).toEqual(
    scenePlanSchema.parse(output).scenes[0].direction,
  );
  expect(
    strictLocalScenePlanSchema.safeParse({
      ...output,
      scenes: [{ ...output.scenes[0], script: null }],
    }).success,
  ).toBe(false);
});
