import { describe, it, expect } from "vitest";

import { aiSceneSchema } from "./types";

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
