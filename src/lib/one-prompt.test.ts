import { describe, expect, it } from "vitest";

import { lintStoryboard } from "@/storyboard";

import {
  buildWriteRequest,
  classifyEntry,
  finishPodcast,
  lengthLabel,
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

describe("lengths", () => {
  it("reads short lengths in seconds and long ones in minutes", () => {
    expect(lengthLabel(30)).toBe("30 s");
    expect(lengthLabel(60)).toBe("60 s");
    expect(lengthLabel(300)).toBe("5 min");
  });
});

describe("finishPodcast", () => {
  it("applies only the music choice", () => {
    expect(finishPodcast({ kind: "podcast" }, { music: false })).toEqual({
      kind: "podcast",
      music: "none",
    });
    expect(
      finishPodcast(
        { kind: "podcast" },
        { music: true, musicTrack: "calm-water" },
      ),
    ).toEqual({ kind: "podcast", music: "calm-water" });
    expect(finishPodcast({ kind: "podcast" }, { musicTrack: "auto" })).toEqual({
      kind: "podcast",
    });
  });

  it("asks the writer for an episode when podcast is chosen", () => {
    const request = buildWriteRequest("Why the sky is blue", {
      format: "9:16",
      seconds: 60,
      podcast: true,
    });
    expect(request?.brief.kind).toBe("podcast");
    expect(
      buildWriteRequest("Why the sky is blue", { format: "9:16", seconds: 60 })
        ?.brief.kind,
    ).toBeUndefined();
  });
});

describe("steps that run by themselves", () => {
  it("turns music and captions off when asked", () => {
    expect(
      finishStoryboard(
        { title: "T" },
        { theme: "auto", narration: true, music: false, captions: false },
      ),
    ).toEqual({ title: "T", music: "none", captions: "off" });
  });

  it("leaves them alone when on or not mentioned", () => {
    expect(
      finishStoryboard(
        { title: "T" },
        { theme: "auto", narration: true, music: true, captions: true },
      ),
    ).toEqual({ title: "T" });
  });

  it("uses a chosen bundled track, but music off wins", () => {
    expect(
      finishStoryboard(
        { title: "T" },
        { theme: "auto", narration: true, musicTrack: "lofi-rain" },
      ),
    ).toEqual({ title: "T", music: "lofi-rain" });
    expect(
      finishStoryboard(
        { title: "T" },
        {
          theme: "auto",
          narration: true,
          music: false,
          musicTrack: "lofi-rain",
        },
      ),
    ).toEqual({ title: "T", music: "none" });
    expect(
      finishStoryboard(
        { title: "T" },
        { theme: "auto", narration: true, musicTrack: "auto" },
      ),
    ).toEqual({ title: "T" });
  });

  it("skips the web lookup for a topic when research is off", () => {
    const on = buildWriteRequest("Why the sky is blue", {
      format: "9:16",
      seconds: 30,
    });
    const off = buildWriteRequest("Why the sky is blue", {
      format: "9:16",
      seconds: 30,
      research: false,
    });
    expect(on?.research).toBe("auto");
    expect(off?.research).toBe("off");
  });
});

describe("the built-in sample", () => {
  it("is a valid storyboard", () => {
    const lint = lintStoryboard(SAMPLE_STORYBOARD);
    expect(lint.errors).toEqual([]);
    expect(lint.storyboard).not.toBeNull();
  });
});
