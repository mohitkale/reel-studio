import { describe, expect, it } from "vitest";

import { lintStoryboard } from "@/storyboard";

import {
  buildWriteRequest,
  classifyEntry,
  finishStoryboard,
  SAMPLE_STORYBOARD,
} from "./one-prompt";

describe("classifyEntry", () => {
  it("tells a topic, a URL, your own text and nothing apart", () => {
    expect(classifyEntry("   ")).toBe("empty");
    expect(classifyEntry("Why the sky is blue")).toBe("topic");
    expect(classifyEntry(" https://example.com/article ")).toBe("url");
    expect(classifyEntry("word ".repeat(151))).toBe("own-text");
    expect(classifyEntry("word ".repeat(150))).toBe("topic");
  });
});

describe("buildWriteRequest", () => {
  const options = { format: "9:16" as const, seconds: 30 };

  it("sends a topic for research", () => {
    expect(buildWriteRequest("Why the sky is blue", options)).toEqual({
      brief: {
        topic: "Why the sky is blue",
        targetSeconds: 30,
        format: "9:16",
      },
      fromSourceText: false,
      research: "auto",
    });
  });

  it("treats long pasted text as the source and does not research it", () => {
    const text = "word ".repeat(200);
    expect(buildWriteRequest(text, options)).toMatchObject({
      fromSourceText: true,
      research: "off",
    });
  });

  it("turns a URL into a brief that names the page", () => {
    const request = buildWriteRequest("https://example.com/a", options)!;
    expect(request.brief.topic).toContain("https://example.com/a");
    expect(request.research).toBe("auto");
  });

  it("builds nothing for an empty box", () => {
    expect(buildWriteRequest("", options)).toBeNull();
  });
});

describe("finishStoryboard", () => {
  it("applies a theme and switches narration off", () => {
    expect(
      finishStoryboard(
        { title: "T", voice: { speed: 1.1 } },
        { theme: "paper", narration: false },
      ),
    ).toEqual({
      title: "T",
      theme: "paper",
      voice: { speed: 1.1, enabled: false },
    });
  });

  it("leaves an automatic theme and narration alone", () => {
    expect(
      finishStoryboard({ title: "T" }, { theme: "auto", narration: true }),
    ).toEqual({
      title: "T",
    });
  });
});

describe("the built-in sample", () => {
  it("is a valid storyboard", () => {
    const lint = lintStoryboard(SAMPLE_STORYBOARD);
    expect(lint.errors).toEqual([]);
    expect(lint.storyboard).not.toBeNull();
  });
});
