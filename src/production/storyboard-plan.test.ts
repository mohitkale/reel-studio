import { describe, expect, it } from "vitest";

import { parseStoryboard } from "@/storyboard";

import {
  STORYBOARD_TEMPLATE_BY_TYPE,
  planFromStoryboard,
} from "./storyboard-plan";

const sb = (overrides: Record<string, unknown> = {}, scenes?: unknown[]) =>
  parseStoryboard({
    version: 1,
    title: "T",
    scenes: scenes ?? [
      {
        type: "hook",
        headline: "Hook",
        narration: "A hook worth hearing today.",
      },
      {
        type: "list",
        headline: "Three things",
        narration: "Here are three things to try.",
        items: ["One", "Two", "Three"],
      },
      {
        type: "stat",
        headline: "Most people agree",
        narration: "Seventy three percent agree.",
        stat: { value: "73%", label: "agree" },
      },
      {
        type: "chart",
        headline: "Growth",
        narration: "Growth doubled in a year.",
        chart: {
          labels: ["A", "B"],
          series: [{ label: "S", values: [1, 2] }],
          source: "Report",
        },
      },
      {
        type: "quote",
        headline: "In their words",
        narration: "As one expert put it.",
        quote: { text: "Plain words.", attribution: "A. Writer" },
      },
      {
        type: "media",
        headline: "A quiet street",
        narration: "Picture a quiet street.",
        media: { query: "quiet city street" },
      },
      {
        type: "cta",
        headline: "Try it",
        narration: "Try it today.",
        body: "Follow for more",
      },
    ],
    ...overrides,
  });

function plan(overrides = {}, scenes?: unknown[], options = {}) {
  return planFromStoryboard(sb(overrides, scenes), options);
}

describe("planFromStoryboard", () => {
  it("maps every scene type to an existing treatment", () => {
    const p = plan();
    expect(p.scenes.map((s) => s.templateId)).toEqual([
      "hf-opener",
      "hf-list",
      "hf-stat",
      "hf-data-chart",
      "hf-quote",
      "hf-broll",
      "hf-cta",
    ]);
    expect(Object.keys(STORYBOARD_TEMPLATE_BY_TYPE).sort()).toEqual([
      "chart",
      "code",
      "cta",
      "hook",
      "list",
      "media",
      "quote",
      "stat",
      "statement",
    ]);
  });

  it("carries items, stat, chart, quote and cta fields", () => {
    const scenes = plan().scenePlan.scenes;
    expect(scenes[1]).toMatchObject({
      items: ["One", "Two", "Three"],
      text: "Three things",
    });
    expect(scenes[2]).toMatchObject({ visual: "73%" });
    expect(scenes[3]!.chart).toEqual({
      labels: ["A", "B"],
      series: [{ label: "S", values: [1, 2] }],
      sourceAttribution: "Report",
    });
    expect(scenes[4]).toMatchObject({
      text: "Plain words.",
      visual: "A. Writer",
    });
    expect(scenes[5]).toMatchObject({ backgroundQuery: "quiet city street" });
    expect(scenes[6]).toMatchObject({ visual: "Follow for more" });
  });

  it("speaks the narration and shows the headline", () => {
    const first = plan().scenePlan.scenes[0]!;
    expect(first.text).toBe("Hook");
    expect(first.spokenText).toBe("A hook worth hearing today.");
  });

  it("maps format to orientation", () => {
    expect(plan({ format: "16:9" }).orientation).toBe("landscape");
    expect(plan({ format: "1:1" }).orientation).toBe("square");
    expect(plan().orientation).toBe("portrait");
  });

  it("defaults to narration, captions and automatic music", () => {
    const p = plan();
    expect(p.voice.enabled).toBe(true);
    expect(p.captions).toBe("auto");
    expect(p.music).toEqual({ mode: "auto" });
  });

  it("honours voice off, captions off, music none and known tracks", () => {
    const p = plan({
      voice: { enabled: false },
      captions: "off",
      music: "none",
    });
    expect(p.voice.enabled).toBe(false);
    expect(p.captions).toBe("off");
    expect(p.music.mode).toBe("none");
    expect(
      plan({ music: "lofi-chill" }, undefined, {
        knownTrackIds: ["lofi-chill"],
      }).music,
    ).toEqual({
      mode: "track",
      trackId: "lofi-chill",
    });
    const unknown = plan({ music: "nope" }, undefined, {
      knownTrackIds: ["lofi-chill"],
    });
    expect(unknown.music.mode).toBe("auto");
    expect(unknown.warnings.join(" ")).toContain("unknown track");
  });

  it("warns about what it does not apply yet instead of dropping it silently", () => {
    const p = plan({ theme: "sunrise", voice: { enabled: true, speed: 1.1 } }, [
      {
        type: "code",
        headline: "Code",
        narration: "Look at this code now.",
        code: { language: "ts", text: "a()" },
      },
      {
        type: "statement",
        headline: "S",
        narration: "A statement here.",
        body: "More",
        icon: "moon",
      },
      {
        type: "media",
        headline: "Clip",
        narration: "A clip plays here.",
        media: { path: "media/a.mp4" },
      },
    ]);
    const text = p.warnings.join("\n");
    for (const part of [
      "code scenes",
      "body is not shown",
      "icon",
      "media paths",
      "voice.speed",
      "theme",
    ]) {
      expect(text).toContain(part);
    }
  });

  it("estimates the spoken length", () => {
    expect(plan().estimatedSeconds).toBeGreaterThan(10);
  });

  it("rejects podcasts", () => {
    const podcast = parseStoryboard({
      version: 1,
      kind: "podcast",
      title: "P",
      speakers: [{ id: "a", name: "A" }],
      turns: [{ speaker: "a", text: "Hi." }],
    });
    expect(() => planFromStoryboard(podcast)).toThrow();
  });
});
