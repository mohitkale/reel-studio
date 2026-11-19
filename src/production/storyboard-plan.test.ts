import { SCENE_TYPES } from "@/storyboard";
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
    expect(Object.keys(STORYBOARD_TEMPLATE_BY_TYPE).sort()).toEqual(
      [...SCENE_TYPES].sort(),
    );
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
    for (const part of ["body is not shown", "media paths"]) {
      expect(text).toContain(part);
    }
    // voice.speed is applied now, so it is passed on instead of warned about.
    expect(text).not.toContain("voice.speed");
    expect(p.voice.speed).toBe(1.1);
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

  it("derives the look from the title, a series or an explicit seed", () => {
    expect(plan().look).toEqual({ seed: "T", variety: "medium" });
    const series = plan({ series: "Weekly Tips" }).look;
    expect(series).toMatchObject({ seed: "series:Weekly Tips", locked: true });
    // Two videos in a series share one seed family.
    expect(plan({ series: "Weekly Tips", title: "Other" }).look.seed).toBe(
      series.seed,
    );
    expect(plan({ series: "Weekly Tips", seed: "mine" }).look.seed).toBe(
      "mine",
    );
  });

  it("carries a resolved illustration and warns about an unknown one", () => {
    const scenes = [
      {
        type: "hook",
        headline: "Hook",
        narration: "A hook worth hearing today.",
        illustration: "space",
      },
      {
        type: "statement",
        headline: "Plain",
        narration: "A plain statement for you.",
        illustration: "unicorn",
      },
    ];
    const result = plan({}, scenes);
    expect(result.scenePlan.scenes[0]!.panel).toMatchObject({
      illustration: "stars-1",
    });
    expect(result.scenePlan.scenes[1]!.panel).not.toHaveProperty(
      "illustration",
    );
    expect(result.warnings.join(" ")).toContain(
      'unknown illustration "unicorn"',
    );
  });
});

describe("scene pace", () => {
  it("turns each scene's pace into a speed multiplier, in scene order", () => {
    const plan = planFromStoryboard(
      sb({}, [
        {
          type: "hook",
          headline: "Hook",
          narration: "A hook worth hearing today.",
          pace: "fast",
        },
        {
          type: "statement",
          headline: "Idea",
          narration: "One idea that should land slowly.",
          pace: "slow",
        },
        { type: "cta", headline: "Go", narration: "Go and try it today." },
      ]),
    );
    expect(plan.scenePaces).toEqual([1.12, 0.88, 1]);
  });
});

describe("stings", () => {
  it("are left to the brand kit unless the storyboard asks for them or turns them off", () => {
    expect(plan().stings).toBe("default");
    expect(plan({ stings: "off" }).stings).toBe("off");
    expect(plan({ stings: "auto" }).stings).toBe("auto");
  });
});

describe("presenter", () => {
  it("is carried in the look with the scenes that turn it off", () => {
    const p = plan({ presenter: { character: "bolt", placement: "full" } }, [
      {
        type: "hook",
        headline: "Hook",
        narration: "A hook worth hearing today.",
      },
      {
        type: "statement",
        headline: "Bare",
        narration: "A scene without the host today.",
        presenter: "off",
      },
      { type: "cta", headline: "Go", narration: "Go and try it today." },
    ]);
    expect(p.look.presenter).toEqual({
      character: "bolt",
      placement: "full",
      off: [1],
    });
    expect(plan().look.presenter).toBeUndefined();
  });
});

describe("recap scene", () => {
  it("is planned as a summary treatment carrying its lines", () => {
    const p = plan({}, [
      {
        type: "hook",
        headline: "Hook",
        narration: "A hook worth hearing today.",
      },
      {
        type: "recap",
        headline: "What we covered",
        narration: "So, to recap: sleep, hours and a dark room.",
        items: [
          "Sleep saves memories",
          "Seven hours is the target",
          "A dark room helps",
        ],
      },
      { type: "cta", headline: "Go", narration: "Go and try it today." },
    ]);
    expect(p.scenes[1]!.templateId).toBe("hf-recap");
    expect(p.roles[1]).toBe("summary");
    expect(p.scenePlan.scenes[1]!.panel).toMatchObject({
      items: [
        "Sleep saves memories",
        "Seven hours is the target",
        "A dark room helps",
      ],
    });
  });
});
