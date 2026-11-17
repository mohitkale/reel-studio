import { describe, expect, it } from "vitest";

import { buildShareCaption } from "@/lib/share-caption";

const source = {
  title: "Why the sky is blue",
  scenes: [
    {
      headline: "Sunlight scatters in the atmosphere",
      narration: "Blue light scatters most.",
    },
    {
      headline: "Sunsets turn red",
      narration: "Light travels through more atmosphere at sunset.",
    },
  ],
};

describe("buildShareCaption", () => {
  it("joins the title and the opening line", () => {
    expect(buildShareCaption(source).caption).toBe(
      "Why the sky is blue. Sunlight scatters in the atmosphere",
    );
  });

  it("ranks title words first and skips filler words and numbers", () => {
    const { hashtags } = buildShareCaption(source);
    expect(hashtags[0]).toBe("#Blue");
    expect(hashtags).not.toContain("#This");
    expect(hashtags.length).toBeLessThanOrEqual(5);
  });

  it("is the same every time", () => {
    expect(buildShareCaption(source)).toEqual(buildShareCaption(source));
  });

  it("handles an empty storyboard", () => {
    expect(buildShareCaption({ title: "Hi", scenes: [] })).toEqual({
      caption: "Hi",
      hashtags: [],
      text: "Hi",
    });
  });
});
