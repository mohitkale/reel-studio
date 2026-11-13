import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { STORYBOARD_LIMITS as L } from "./schema";
import { cutAtBoundary, estimateDurationSeconds, lintStoryboard } from "./lint";

const TODAY = "2026-11-13";
const lint = (input: unknown, options = {}) =>
  lintStoryboard(input, { today: TODAY, ...options });

function scene(overrides: Record<string, unknown> = {}) {
  return {
    type: "statement",
    headline: "A clear headline",
    narration: "This sentence is spoken aloud by the voice.",
    ...overrides,
  };
}
function video(scenes: unknown[], root: Record<string, unknown> = {}) {
  return { version: 1, title: "T", scenes, ...root };
}
/** One scene between a hook and a cta so structural warnings stay quiet. */
function single(overrides: Record<string, unknown> = {}, root = {}) {
  return video(
    [
      scene({
        type: "hook",
        headline: "Hook line",
        narration: "A hook worth hearing.",
      }),
      scene(overrides),
      scene({
        type: "cta",
        headline: "Try it",
        narration: "Try it today, it is free.",
      }),
    ],
    root,
  );
}
const rules = (r: ReturnType<typeof lint>) => r.fixes.map((f) => f.rule);
const warns = (r: ReturnType<typeof lint>) => r.warnings.map((w) => w.rule);
const mid = (r: ReturnType<typeof lint>) =>
  r.storyboard?.kind === "video" ? r.storyboard.scenes[1]! : undefined;

describe("recorded model outputs", () => {
  const dir = path.join(__dirname, "fixtures", "model-outputs");
  const files = readdirSync(dir).filter((f) => /\.(json|txt)$/.test(f));

  it("has twenty fixtures from both prompting styles", () => {
    expect(files).toHaveLength(20);
    expect(files.filter((f) => f.includes("-chat-"))).toHaveLength(10);
  });

  it.each(files)(
    "%s ends as a valid storyboard (at most one error)",
    (file) => {
      const result = lint(readFileSync(path.join(dir, file), "utf8"));
      expect(result.errors.length).toBeLessThanOrEqual(1);
      expect(result.storyboard).not.toBeNull();
    },
  );

  it("is idempotent: linting the repaired storyboard changes nothing", () => {
    for (const file of files) {
      const first = lint(readFileSync(path.join(dir, file), "utf8"));
      const second = lint(first.storyboard);
      expect(second.fixes, file).toEqual([]);
      expect(second.storyboard).toEqual(first.storyboard);
    }
  });
});

describe("extraction", () => {
  const body = JSON.stringify(video([scene()]));
  it("reads a fenced reply with prose around it", () => {
    const r = lint(
      `Sure! Here you go:\n\`\`\`json\n${body}\n\`\`\`\nHope it helps.`,
    );
    expect(r.storyboard).not.toBeNull();
    expect(rules(r)).toContain("extract-json");
  });
  it("leaves clean JSON untouched", () => {
    expect(rules(lint(body))).toEqual([]);
  });
  it("removes trailing commas", () => {
    const r = lint(
      '{"version":1,"title":"T","scenes":[{"type":"statement","headline":"H","narration":"N is here",},],}',
    );
    expect(rules(r)).toContain("trailing-commas");
    expect(r.storyboard).not.toBeNull();
  });
  it("unwraps a { storyboard } wrapper", () => {
    expect(rules(lint({ storyboard: video([scene()]) }))).toContain("unwrap");
  });
  it("errors, with expected and example, on text that is not JSON", () => {
    const r = lint("I could not do that.");
    expect(r.storyboard).toBeNull();
    expect(r.errors[0]).toMatchObject({
      path: "",
      expected: "one JSON object",
    });
    expect(r.errors[0]!.example).toContain("version");
  });
  it("errors on a non-object", () => {
    expect(lint([1, 2]).errors).toHaveLength(1);
  });
});

describe("auto-repair", () => {
  it("fills the version and trims whitespace", () => {
    const r = lint({
      title: "  T  ",
      scenes: [scene({ headline: "  Spaced   out  " })],
    });
    expect(r.storyboard).not.toBeNull();
    expect(rules(r)).toEqual(expect.arrayContaining(["fill-default", "trim"]));
  });

  it("clamps the scene count", () => {
    const many = Array.from({ length: 45 }, () => scene());
    const r = lint(video(many));
    expect(rules(r)).toContain("clamp-scenes");
    expect(r.storyboard?.kind === "video" && r.storyboard.scenes.length).toBe(
      L.scenes.max,
    );
    expect(rules(lint(video([scene()])))).not.toContain("clamp-scenes");
  });

  it("moves an overlong headline into body and shortens it at a clause boundary", () => {
    const long =
      "Sleep is not luck, it is a skill that anyone can practise every night";
    const r = lint(single({ headline: long }));
    const s = mid(r)!;
    expect(rules(r)).toContain("headline-to-body");
    expect(s.body).toBe(long);
    expect(s.headline).toBe("Sleep is not luck");
    expect(s.headline.length).toBeLessThanOrEqual(L.headline);
  });

  it("keeps an existing body and warns when the headline is shortened", () => {
    const r = lint(
      single({ headline: "x".repeat(70) + " end", body: "Existing" }),
    );
    expect(mid(r)!.body).toBe("Existing");
    expect(warns(r)).toContain("headline-cut");
  });

  it("cuts overlong narration at a sentence boundary", () => {
    const narration = `${"A short sentence here. ".repeat(25)}`.trim();
    const r = lint(single({ narration }));
    expect(rules(r)).toContain("shorten-narration");
    expect(mid(r)!.narration.endsWith(".")).toBe(true);
    expect(mid(r)!.narration.length).toBeLessThanOrEqual(L.narration);
  });

  it("drops unknown fields, including internal ids", () => {
    const r = lint(
      single(
        { templateId: "hf-opener", layout: "wide" },
        { theme: "Sunrise Glow", foo: 1 },
      ),
    );
    expect(
      r.fixes.filter((f) => f.rule === "drop-unknown-field").map((f) => f.path),
    ).toEqual(
      expect.arrayContaining(["scenes.1.templateId", "scenes.1.layout", "foo"]),
    );
    expect(rules(r)).toContain("normalize-theme");
    expect(JSON.stringify(r.storyboard)).not.toContain("hf-opener");
  });

  it("maps near-miss enum values", () => {
    const r = lint(
      single(
        { type: "bullet-list", items: ["a", "b"] },
        { format: "vertical", captions: "off", music: "Silent" },
      ),
    );
    expect(mid(r)!.type).toBe("list");
    expect(r.storyboard).toMatchObject({
      format: "9:16",
      captions: "off",
      music: "none",
    });
    expect(lint(single({ type: "Call To Action" })).storyboard).not.toBeNull();
    expect(
      mid(lint(single({ type: "b-roll", media: { query: "a street" } })))!.type,
    ).toBe("media");
    expect(
      lint(video([scene()], { format: "16x9 landscape" })).storyboard,
    ).toMatchObject({ format: "16:9" });
  });

  it("uses an inferred type for an unknown one", () => {
    const r = lint(single({ type: "mystery", items: ["a", "b"] }));
    expect(mid(r)!.type).toBe("list");
  });

  it("renames common field aliases", () => {
    const r = lint(
      video([
        {
          type: "statement",
          title: "Heading",
          voiceover: "Spoken words go here.",
          bullets: undefined,
        },
      ]),
    );
    expect(mid({ ...r, storyboard: r.storyboard })).toBeUndefined();
    expect(
      r.storyboard?.kind === "video" && r.storyboard.scenes[0],
    ).toMatchObject({
      headline: "Heading",
      narration: "Spoken words go here.",
    });
    expect(rules(r)).toContain("rename-field");
  });

  it("derives a missing headline or narration", () => {
    const a = lint(
      video([
        {
          type: "statement",
          narration: "First clause here, then more words follow it.",
        },
      ]),
    );
    expect(rules(a)).toContain("derive-headline");
    const b = lint(video([{ type: "statement", headline: "Only a headline" }]));
    expect(rules(b)).toContain("derive-narration");
    expect(warns(b)).toContain("headline-equals-narration");
  });

  it("repairs items: split text, clamp count, shorten long items", () => {
    const r = lint(
      single({
        type: "list",
        items: Array.from(
          { length: 8 },
          (_, i) => `Item ${i + 1} ${"x".repeat(i === 0 ? 70 : 0)}`,
        ),
      }),
    );
    expect(rules(r)).toEqual(
      expect.arrayContaining(["clamp-items", "shorten-item"]),
    );
    expect(
      lint(single({ type: "list", items: "- one\n- two\n- three" })).storyboard,
    ).not.toBeNull();
  });

  it("turns a one-item list into a statement and warns", () => {
    const r = lint(single({ type: "list", items: ["Only one"] }));
    expect(mid(r)!.type).toBe("statement");
    expect(warns(r)).toContain("list-one-item");
  });

  it("builds stat, code and quote objects from loose shapes", () => {
    expect(
      mid(lint(single({ type: "stat", value: "73%", label: "better focus" })))!
        .stat,
    ).toEqual({ value: "73%", label: "better focus" });
    expect(mid(lint(single({ type: "stat", stat: "73%" })))!.stat?.value).toBe(
      "73%",
    );
    expect(
      mid(lint(single({ type: "code", code: "git push", language: "bash" })))!
        .code,
    ).toEqual({ language: "bash", text: "git push" });
    expect(
      mid(
        lint(
          single({
            type: "quote",
            quote: "Plain words.",
            attribution: "A. Writer",
          }),
        ),
      )!.quote,
    ).toEqual({ text: "Plain words.", attribution: "A. Writer" });
  });

  it("derives a stat from the scene text when one is missing", () => {
    const r = lint(
      single({ type: "stat", headline: "73% report better focus" }),
    );
    expect(rules(r)).toContain("derive-stat");
    expect(mid(r)!.stat?.value).toBe("73%");
  });

  it("converts chart.data rows", () => {
    const r = lint(
      single({
        type: "chart",
        chart: {
          data: [
            { label: "A", value: 1 },
            { label: "B", value: 2 },
          ],
          title: "Totals",
          sourceAttribution: "Report",
        },
      }),
    );
    expect(rules(r)).toContain("convert-chart");
    expect(mid(r)!.chart).toMatchObject({
      labels: ["A", "B"],
      source: "Report",
    });
  });

  it("repairs media shapes and keeps one source", () => {
    expect(
      mid(lint(single({ type: "media", media: "a quiet street" })))!.media,
    ).toEqual({ query: "a quiet street" });
    const both = lint(
      single({
        type: "media",
        media: { query: "a street", path: "media/a.mp4" },
      }),
    );
    expect(rules(both)).toContain("single-media-source");
    expect(
      mid(
        lint(
          single({
            type: "media",
            media: { kind: "image", source: "x" },
            headline: "A quiet street",
          }),
        ),
      )!.media,
    ).toEqual({ query: "A quiet street" });
  });

  it("normalizes icon, emphasis and durationHint", () => {
    const r = lint(
      single({
        icon: "Moon Phase",
        emphasis: ["a", "b", "c", "d"],
        durationHint: 90,
      }),
    );
    const s = mid(r)!;
    expect(s.icon).toBe("moon-phase");
    expect(s.emphasis).toHaveLength(L.emphasisCount);
    expect(s.durationHint).toBe(L.durationHint.max);
    expect(rules(r)).toEqual(
      expect.arrayContaining([
        "normalize-icon",
        "clamp-emphasis",
        "clamp-duration",
      ]),
    );
  });

  it("repairs voice, music and sources", () => {
    const r = lint(
      single(
        {},
        {
          voice: { enabled: true, speed: 3, style: "warm" },
          music: { mood: "calm" },
          sources: [
            { title: "Good", url: "https://example.com/a" },
            { title: "Bad", url: "not a url" },
          ],
        },
      ),
    );
    expect(r.storyboard).toMatchObject({
      voice: { speed: 1.3 },
      music: "auto",
      sources: [{ url: "https://example.com/a", accessed: TODAY }],
    });
    expect(rules(r)).toEqual(
      expect.arrayContaining(["clamp-speed", "drop-source", "fill-default"]),
    );
  });

  it("derives a missing title from the first headline", () => {
    const r = lint({
      version: 1,
      scenes: [scene({ headline: "Opening line" })],
    });
    expect(rules(r)).toContain("derive-title");
  });

  it("repairs podcast speakers and turns", () => {
    const r = lint({
      title: "P",
      hosts: [{ name: "Maya" }, { name: "Sam" }],
      dialogue: [
        { speaker: "Maya", line: "Hello." },
        { speaker: "sam", text: "Hi there." },
      ],
    });
    expect(r.errors).toEqual([]);
    expect(r.storyboard).toMatchObject({
      kind: "podcast",
      turns: [{ speaker: "maya" }, { speaker: "sam" }],
    });
    expect(rules(r)).toEqual(
      expect.arrayContaining([
        "infer-kind",
        "rename-field",
        "derive-id",
        "map-speaker",
      ]),
    );
  });
});

describe("warnings", () => {
  it("flags a headline that equals the narration", () => {
    expect(
      warns(lint(single({ headline: "Same words", narration: "Same words." }))),
    ).toContain("headline-equals-narration");
    expect(warns(lint(single()))).not.toContain("headline-equals-narration");
  });
  it("flags three of a type in a row, not two", () => {
    expect(
      warns(
        lint(
          video([
            scene({ type: "hook" }),
            scene(),
            scene(),
            scene(),
            scene({ type: "cta" }),
          ]),
        ),
      ),
    ).toContain("repeated-type");
    expect(
      warns(
        lint(
          video([
            scene({ type: "hook" }),
            scene(),
            scene(),
            scene({ type: "cta" }),
          ]),
        ),
      ),
    ).not.toContain("repeated-type");
  });
  it("flags a missing hook and a missing closing scene", () => {
    const r = lint(
      video([
        scene(),
        scene({ type: "quote", quote: { text: "T", attribution: "A" } }),
      ]),
    );
    expect(warns(r)).toEqual(expect.arrayContaining(["no-hook", "no-closing"]));
    expect(warns(lint(single()))).not.toEqual(
      expect.arrayContaining(["no-hook"]),
    );
  });
  it("flags narration under 3 or over 40 words", () => {
    expect(warns(lint(single({ narration: "Two words" })))).toContain(
      "narration-length",
    );
    expect(
      warns(lint(single({ narration: Array(41).fill("word").join(" ") }))),
    ).toContain("narration-length");
    expect(warns(lint(single()))).not.toContain("narration-length");
  });
  it("flags a stat without a number", () => {
    expect(
      warns(
        lint(
          single({ type: "stat", stat: { value: "Most", label: "adults" } }),
        ),
      ),
    ).toContain("stat-without-number");
    expect(
      warns(
        lint(single({ type: "stat", stat: { value: "73%", label: "adults" } })),
      ),
    ).not.toContain("stat-without-number");
  });
  it("flags a duration outside the requested range", () => {
    const sb = single();
    expect(warns(lint(sb, { minSeconds: 60 }))).toContain("duration");
    expect(warns(lint(sb, { maxSeconds: 1 }))).toContain("duration");
    expect(warns(lint(sb, { minSeconds: 1, maxSeconds: 120 }))).not.toContain(
      "duration",
    );
  });
});

describe("errors", () => {
  it("only reports what cannot be repaired, with path, expected and example", () => {
    const r = lint(
      single({
        type: "chart",
        chart: {
          labels: ["a", "b"],
          series: [{ label: "s", values: [1, 2, 3] }],
        },
      }),
    );
    expect(r.storyboard).toBeNull();
    expect(r.errors[0]).toMatchObject({ path: "scenes.1.chart" });
    for (const e of r.errors) {
      expect(e.expected.length).toBeGreaterThan(0);
      expect(e.example.length).toBeGreaterThan(0);
    }
  });
  it("needs scenes", () => {
    const r = lint({ version: 1, title: "T" });
    expect(r.errors.some((e) => e.path === "scenes")).toBe(true);
  });
  it("rejects an unsafe media path and a quote with no attribution", () => {
    expect(
      lint(single({ type: "media", media: { path: "../secret.mp4" } })).errors,
    ).not.toHaveLength(0);
    const q = lint(single({ type: "quote", quote: "Words with no speaker" }));
    expect(q.errors[0]!.path).toContain("quote");
  });
  it("needs a list to carry items", () => {
    expect(lint(single({ type: "list" })).errors[0]).toMatchObject({
      path: "scenes.1.items",
    });
    expect(lint(single({ type: "list", items: ["a", "b"] })).errors).toEqual(
      [],
    );
  });
});

describe("helpers", () => {
  it("cuts at the best boundary within the limit", () => {
    expect(cutAtBoundary("Short", 60)).toBe("Short");
    expect(
      cutAtBoundary("One sentence ends here. And a second one follows it.", 30),
    ).toBe("One sentence ends here.");
    expect(
      cutAtBoundary(
        "A clause here, then a long tail without any punctuation at all",
        30,
      ),
    ).toBe("A clause here");
    expect(cutAtBoundary("alpha beta gamma delta epsilon", 14)).toBe(
      "alpha beta",
    );
  });
  it("estimates duration from narration length", () => {
    const sb = lint(single()).storyboard!;
    expect(estimateDurationSeconds(sb)).toBeGreaterThan(5);
  });
});
