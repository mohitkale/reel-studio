import { describe, expect, it } from "vitest";

import { buildPublishingKit, checkPlatforms } from "@/lib/publishing-kit";

const source = {
  title: "Why the sky is blue",
  scenes: [
    {
      headline: "Why is the sky blue?",
      narration: "Sunlight looks white, so why is the sky blue?",
    },
    {
      headline: "Blue light scatters most",
      narration: "Air scatters short waves.",
    },
    {
      headline: "Sunsets turn red",
      narration: "Light travels through more air.",
    },
  ],
  sources: [{ title: "NASA", url: "https://example.com/sky" }],
};

describe("buildPublishingKit", () => {
  it("builds a description from the opening line, the scene headlines and the sources", () => {
    const kit = buildPublishingKit(source);
    expect(kit.title).toBe("Why the sky is blue");
    expect(kit.description).toContain("Sunlight looks white");
    expect(kit.description).toContain(
      "In this video:\n- Blue light scatters most\n- Sunsets turn red",
    );
    expect(kit.description).toContain(
      "Sources:\n- NASA: https://example.com/sky",
    );
    expect(kit.description.endsWith(kit.hashtagLine)).toBe(true);
    expect(kit.hashtags.length).toBeGreaterThan(0);
  });

  it("is deterministic", () => {
    expect(buildPublishingKit(source)).toEqual(buildPublishingKit(source));
  });

  it("shortens a very long title at a word", () => {
    const kit = buildPublishingKit({
      ...source,
      title: `${"word ".repeat(40)}end`,
    });
    expect(kit.title.length).toBeLessThanOrEqual(100);
    expect(kit.title.endsWith("…")).toBe(true);
  });
});

describe("what the writer chose for posting", () => {
  it("wins over the text-built defaults and keeps the scene list and sources", () => {
    const kit = buildPublishingKit({
      ...source,
      publish: {
        title: "The real reason the sky is blue",
        description: "Light scatters; blue scatters most.",
        hashtags: ["science", "#sky"],
        thumbnailText: "Why blue?",
      },
    });
    expect(kit.title).toBe("The real reason the sky is blue");
    expect(kit.thumbnailText).toBe("Why blue?");
    expect(kit.hashtags).toEqual(["#science", "#sky"]);
    expect(
      kit.description.startsWith("Light scatters; blue scatters most."),
    ).toBe(true);
    expect(kit.description).toContain("In this video:");
    expect(kit.description).toContain("Sources:");
    expect(kit.description.endsWith("#science #sky")).toBe(true);
  });

  it("falls back to the title for thumbnail text", () => {
    expect(buildPublishingKit(source).thumbnailText).toBe(
      "Why the sky is blue",
    );
  });
});

describe("checkPlatforms", () => {
  it("passes a normal kit everywhere", () => {
    expect(checkPlatforms(buildPublishingKit(source)).every((p) => p.ok)).toBe(
      true,
    );
  });

  it("says what is over the limit", () => {
    const kit = {
      ...buildPublishingKit(source),
      description: "x".repeat(2300),
    };
    const fits = Object.fromEntries(checkPlatforms(kit).map((p) => [p.id, p]));
    expect(fits.youtube!.ok).toBe(true);
    expect(fits.reels!.ok).toBe(false);
    expect(fits.reels!.problems[0]).toContain("2300 of 2200");
  });
});
