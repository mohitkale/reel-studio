import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  STORYBOARD_LIMITS,
  parseStoryboard,
  storyboardJsonSchema,
} from "./schema";

const root = path.resolve(__dirname, "..", "..");
const doc = readFileSync(path.join(root, "docs", "STORYBOARD.md"), "utf8");
const examples = [...doc.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => m[1]!);

function video(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    title: "T",
    scenes: [{ type: "statement", headline: "H", narration: "N." }],
    ...overrides,
  };
}
function scene(overrides: Record<string, unknown>) {
  return video({
    scenes: [
      { type: "statement", headline: "H", narration: "N.", ...overrides },
    ],
  });
}

describe("documented examples", () => {
  it("has three examples and all validate", () => {
    expect(examples).toHaveLength(3);
    for (const example of examples) {
      expect(() => parseStoryboard(example)).not.toThrow();
    }
  });

  it("keeps a 60-second video under 120 lines of JSON", () => {
    const sixty = examples[0]!;
    expect(sixty.trimEnd().split("\n").length).toBeLessThan(120);
    const parsed = parseStoryboard(sixty);
    if (parsed.kind !== "video") throw new Error("expected a video");
    const words = parsed.scenes
      .map((s) => s.narration)
      .join(" ")
      .split(/\s+/).length;
    // About 2.5 spoken words per second.
    expect(words / 2.5).toBeGreaterThan(40);
    expect(words / 2.5).toBeLessThan(75);
  });

  it("applies defaults for a video without kind", () => {
    const parsed = parseStoryboard(examples[0]!);
    expect(parsed.kind).toBe("video");
    if (parsed.kind === "video") {
      expect(parsed.format).toBe("9:16");
      expect(parsed.captions).toBe("auto");
    }
    expect(parsed.music).toBe("auto");
  });
});

describe("published JSON Schema", () => {
  it("matches the checked-in file (run npm run storyboard:schema)", () => {
    const file = readFileSync(
      path.join(root, "schemas", "storyboard.v1.json"),
      "utf8",
    );
    expect(file).toBe(`${JSON.stringify(storyboardJsonSchema(), null, 2)}\n`);
  });

  it("describes every property for a model and names no internal ids", () => {
    const missing: string[] = [];
    const walk = (node: unknown, trail: string): void => {
      if (!node || typeof node !== "object") return;
      const record = node as Record<string, unknown>;
      const properties = record.properties as
        Record<string, Record<string, unknown>> | undefined;
      for (const [key, child] of Object.entries(properties ?? {})) {
        if (typeof child.description !== "string")
          missing.push(`${trail}.${key}`);
        walk(child, `${trail}.${key}`);
      }
      for (const value of Object.values(record)) walk(value, trail);
    };
    const schema = storyboardJsonSchema();
    walk(schema, "$");
    expect(missing).toEqual([]);
    const text = JSON.stringify(schema);
    expect(text).not.toMatch(/hf[.-]|capabilityId|recipe|templateId|catalog/i);
  });
});

describe("validation limits", () => {
  it("rejects internal ids and unknown fields", () => {
    expect(() => parseStoryboard(scene({ templateId: "hf-opener" }))).toThrow();
    expect(() => parseStoryboard(video({ recipeId: "x" }))).toThrow();
  });

  it("enforces text limits", () => {
    expect(() =>
      parseStoryboard(
        scene({ headline: "x".repeat(STORYBOARD_LIMITS.headline + 1) }),
      ),
    ).toThrow();
    expect(() =>
      parseStoryboard(
        scene({ narration: "x".repeat(STORYBOARD_LIMITS.narration + 1) }),
      ),
    ).toThrow();
  });

  it("requires the field each scene type needs", () => {
    for (const type of ["list", "stat", "chart", "quote", "code", "media"]) {
      expect(() => parseStoryboard(scene({ type }))).toThrow(/needs/);
    }
    expect(() =>
      parseStoryboard(scene({ type: "list", items: ["a", "b"] })),
    ).not.toThrow();
  });

  it("checks chart shape", () => {
    const chart = (values: number[]) =>
      scene({
        type: "chart",
        chart: { labels: ["a", "b"], series: [{ label: "s", values }] },
      });
    expect(() => parseStoryboard(chart([1, 2]))).not.toThrow();
    expect(() => parseStoryboard(chart([1, 2, 3]))).toThrow(
      /one value per label/,
    );
  });

  it("needs exactly one media source and a safe path", () => {
    const media = (m: unknown) => scene({ type: "media", media: m });
    expect(() => parseStoryboard(media({ query: "a sunrise" }))).not.toThrow();
    expect(() => parseStoryboard(media({}))).toThrow();
    expect(() =>
      parseStoryboard(media({ query: "a sunrise", assetId: "x" })),
    ).toThrow();
    for (const path of [
      "../secret.mp4",
      "/etc/passwd",
      "C:\\x.mp4",
      "file:///x",
      "a/../b",
    ]) {
      expect(() => parseStoryboard(media({ path }))).toThrow();
    }
    expect(() =>
      parseStoryboard(media({ path: "media/demo.mp4" })),
    ).not.toThrow();
  });

  it("accepts only http(s) sources with a date", () => {
    const sources = (url: string, accessed = "2026-11-13") =>
      video({ sources: [{ title: "t", url, accessed }] });
    expect(() =>
      parseStoryboard(sources("https://example.com/a")),
    ).not.toThrow();
    expect(() => parseStoryboard(sources("javascript:alert(1)"))).toThrow();
    expect(() => parseStoryboard(sources("file:///etc/passwd"))).toThrow();
    expect(() =>
      parseStoryboard(sources("https://example.com", "yesterday")),
    ).toThrow();
  });

  it("validates podcast speakers and turns", () => {
    const podcast = (
      turns: unknown,
      speakers: unknown = [{ id: "a", name: "A" }],
    ) => ({
      version: 1,
      kind: "podcast",
      title: "P",
      speakers,
      turns,
    });
    expect(() =>
      parseStoryboard(podcast([{ speaker: "a", text: "Hi." }])),
    ).not.toThrow();
    expect(() =>
      parseStoryboard(podcast([{ speaker: "b", text: "Hi." }])),
    ).toThrow(/Unknown speaker/);
    expect(() =>
      parseStoryboard(
        podcast(
          [{ speaker: "a", text: "Hi." }],
          [
            { id: "a", name: "A" },
            { id: "a", name: "B" },
          ],
        ),
      ),
    ).toThrow(/Duplicate/);
  });

  it("only accepts version 1", () => {
    expect(() => parseStoryboard(video({ version: 2 }))).toThrow();
  });
});
