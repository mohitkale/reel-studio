import { describe, it, expect } from "vitest";

import { stripMarkdown } from "@/lib/strip-markdown";
import { aiSceneSchema, scenePlanSchema } from "./types";

const base = { text: "Hello", templateId: "kinetic", emphasis: [] };

describe("aiSceneSchema effect normalization", () => {
  it("keeps a valid pan effect", () => {
    const s = aiSceneSchema.parse({ ...base, effect: "pan-left" });
    expect(s.effect).toBe("pan-left");
  });

  it("normalizes an unknown effect to undefined instead of throwing", () => {
    const s = aiSceneSchema.parse({ ...base, effect: "zoom-blast" });
    expect(s.effect).toBeUndefined();
  });

  it("allows the effect to be omitted", () => {
    const s = aiSceneSchema.parse(base);
    expect(s.effect).toBeUndefined();
  });

  it("keeps a backgroundQuery when present", () => {
    const s = aiSceneSchema.parse({ ...base, backgroundQuery: "sunrise over mountains" });
    expect(s.backgroundQuery).toBe("sunrise over mountains");
  });
});

describe("stripMarkdown", () => {
  it("removes asterisk emphasis from spoken text", () => {
    expect(stripMarkdown("This is *great* news")).toBe("This is great news");
  });

  it("removes bold markdown", () => {
    expect(stripMarkdown("**Strong** claim")).toBe("Strong claim");
  });
});

describe("scenePlanSchema markdown sanitization", () => {
  it("strips markdown from scene text and normalizes emphasis", () => {
    const plan = scenePlanSchema.parse({
      projectName: "My **Project**",
      scriptName: "Episode *One*",
      scenes: [{ ...base, text: "This is *great* news", emphasis: ["*great*"] }],
    });
    expect(plan.scenes[0].text).toBe("This is great news");
    expect(plan.scenes[0].emphasis).toEqual(["great"]);
    expect(plan.projectName).toBe("My Project");
    expect(plan.scriptName).toBe("Episode One");
  });
});
