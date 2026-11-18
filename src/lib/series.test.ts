import { describe, expect, it } from "vitest";

import {
  applySeries,
  findSeries,
  parseTopics,
  seriesSchema,
} from "@/lib/series";

const series = seriesSchema.parse({
  name: "Daily tips",
  theme: "bold-pop",
  format: "9:16",
  voiceId: "af_heart",
  music: "upbeat-pop",
  narration: true,
  captions: false,
});

describe("applySeries", () => {
  it("fills in what the storyboard leaves out", () => {
    const out = applySeries({ version: 1, title: "T", scenes: [] }, series);
    expect(out).toMatchObject({
      format: "9:16",
      theme: "bold-pop",
      music: "upbeat-pop",
      captions: "off",
      voice: { voiceId: "af_heart" },
    });
  });

  it("never overwrites what the storyboard sets", () => {
    const out = applySeries(
      {
        version: 1,
        title: "T",
        format: "16:9",
        theme: "neon",
        music: "none",
        captions: "auto",
        voice: { voiceId: "am_adam" },
        scenes: [],
      },
      series,
    );
    expect(out).toMatchObject({
      format: "16:9",
      theme: "neon",
      music: "none",
      captions: "auto",
      voice: { voiceId: "am_adam" },
    });
  });

  it("turns narration off when the series says so, and leaves podcasts their own look", () => {
    const silent = seriesSchema.parse({ name: "Quiet", narration: false });
    expect(applySeries({ title: "T" }, silent)).toMatchObject({
      voice: { enabled: false },
    });
    const podcast = applySeries({ kind: "podcast", title: "P" }, series);
    expect(podcast).toMatchObject({ music: "upbeat-pop" });
    expect(podcast).not.toHaveProperty("theme");
    expect(podcast).not.toHaveProperty("voice");
  });

  it("treats auto as not chosen, because writers often say auto", () => {
    const out = applySeries(
      { version: 1, title: "T", theme: "auto", music: "auto", scenes: [] },
      series,
    );
    expect(out).toMatchObject({ theme: "bold-pop", music: "upbeat-pop" });
  });

  it("does not change the input", () => {
    const input = { title: "T" };
    applySeries(input, series);
    expect(input).toEqual({ title: "T" });
  });
});

describe("series list", () => {
  it("finds a series by name, ignoring case", () => {
    expect(findSeries([series], "daily TIPS")?.name).toBe("Daily tips");
    expect(findSeries([series], "nope")).toBeUndefined();
    expect(findSeries(undefined, "x")).toBeUndefined();
  });

  it("rejects odd names and unknown fields", () => {
    expect(seriesSchema.safeParse({ name: "<b>x</b>" }).success).toBe(false);
    expect(seriesSchema.safeParse({ name: "ok", extra: 1 }).success).toBe(
      false,
    );
  });
});

describe("parseTopics", () => {
  it("takes one topic per line and drops blanks and repeats", () => {
    expect(
      parseTopics("Why sleep matters\n\nWhy sleep matters\n  Cold showers  \n"),
    ).toEqual(["Why sleep matters", "Cold showers"]);
  });

  it("reads the first column of a CSV and skips a header", () => {
    expect(
      parseTopics('topic,notes\nBlack holes,for kids\n"Tea, brewed",x\nMoss,'),
    ).toEqual(["Black holes", "Tea, brewed", "Moss"]);
  });

  it("stops at the limit", () => {
    const many = Array.from({ length: 80 }, (_, i) => `Topic ${i}`).join("\n");
    expect(parseTopics(many, 50)).toHaveLength(50);
  });
});

describe("series chimes, voice style and language", () => {
  const rich = seriesSchema.parse({
    name: "Calm facts",
    stings: true,
    voiceStyle: "calm",
    language: "es",
  });

  it("fills them in when the storyboard leaves them out", () => {
    const out = applySeries({ version: 1, title: "T", scenes: [] }, rich);
    expect(out).toMatchObject({
      stings: "auto",
      language: "es",
      voice: { style: "calm" },
    });
  });

  it("keeps what the storyboard sets", () => {
    const out = applySeries(
      {
        version: 1,
        title: "T",
        stings: "off",
        language: "fr",
        voice: { style: "news" },
        scenes: [],
      },
      rich,
    );
    expect(out).toMatchObject({
      stings: "off",
      language: "fr",
      voice: { style: "news" },
    });
  });

  it("rejects a voice style that does not exist", () => {
    expect(() =>
      seriesSchema.parse({ name: "x", voiceStyle: "robot" }),
    ).toThrow();
  });
});
