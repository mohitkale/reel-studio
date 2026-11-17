import { describe, expect, it } from "vitest";

import {
  applyOverrides,
  defaultOutputName,
  describeErrors,
  parseRenderArgs,
  UsageError,
} from "./core";

describe("parseRenderArgs", () => {
  it("reads a file and every option", () => {
    expect(
      parseRenderArgs([
        "story.json",
        "-o",
        "out.mp4",
        "--format",
        "16:9",
        "--theme",
        "editorial",
        "--quality",
        "draft",
        "--no-voice",
        "--json",
      ]),
    ).toEqual({
      file: "story.json",
      out: "out.mp4",
      format: "16:9",
      theme: "editorial",
      quality: "draft",
      noVoice: true,
      json: true,
    });
  });

  it("reads stdin with a dash and defaults to standard quality", () => {
    expect(parseRenderArgs(["-"])).toMatchObject({
      file: "-",
      quality: "standard",
      noVoice: false,
    });
  });

  it("rejects what it cannot use", () => {
    expect(() => parseRenderArgs([])).toThrow(UsageError);
    expect(() => parseRenderArgs(["a.json", "--format", "4:3"])).toThrow(
      /--format/,
    );
    expect(() => parseRenderArgs(["a.json", "--quality"])).toThrow(/value/);
    expect(() => parseRenderArgs(["a.json", "--bogus"])).toThrow(/Unknown/);
    expect(() => parseRenderArgs(["a.json", "b.json"])).toThrow(/Unexpected/);
  });
});

describe("applyOverrides", () => {
  it("sets format, theme and silent narration without touching the rest", () => {
    const next = applyOverrides(
      { title: "T", voice: { speed: 1.1 }, scenes: [] },
      { format: "1:1", theme: "paper", noVoice: true },
    ) as Record<string, unknown>;
    expect(next).toMatchObject({
      title: "T",
      format: "1:1",
      theme: "paper",
      voice: { speed: 1.1, enabled: false },
    });
  });

  it("leaves a non-object alone so linting can reject it", () => {
    expect(applyOverrides("nope", { noVoice: true })).toBe("nope");
  });
});

describe("messages", () => {
  it("prints path, message, expected and example for each error", () => {
    expect(
      describeErrors({
        errors: [
          {
            path: "scenes[0].type",
            message: "Unknown scene type",
            expected: "one of hook, list",
            example: '"hook"',
          },
        ],
      }),
    ).toEqual([
      "✗ scenes[0].type: Unknown scene type",
      "    expected: one of hook, list",
      '    example:  "hook"',
    ]);
  });

  it("makes a safe file name from the title", () => {
    expect(defaultOutputName("Five Excel shortcuts: worth learning!")).toBe(
      "five-excel-shortcuts-worth-learning.mp4",
    );
    expect(defaultOutputName(undefined)).toBe("video.mp4");
  });
});
