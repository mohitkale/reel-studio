import { describe, it, expect } from "vitest";

import { buildCaptions, framesToTimestamp, parseCaptions } from "./captions";

describe("framesToTimestamp", () => {
  it("formats frames as HH:MM:SS with the right millisecond separator", () => {
    expect(framesToTimestamp(0, 30, "srt")).toBe("00:00:00,000");
    expect(framesToTimestamp(0, 30, "vtt")).toBe("00:00:00.000");
    // 45 frames @ 30fps = 1.5s
    expect(framesToTimestamp(45, 30, "srt")).toBe("00:00:01,500");
    // 1h 1m 1s 100ms worth of frames
    const frames = (3600 + 61) * 30 + 3; // 3661s + 100ms
    expect(framesToTimestamp(frames, 30, "vtt")).toBe("01:01:01.100");
  });
});

describe("buildCaptions", () => {
  const cues = [
    { startFrame: 0, endFrame: 45, text: "Hello   world" },
    { startFrame: 54, endFrame: 84, text: "Second\nline" },
  ];

  it("produces valid SRT with sequential indices and comma timestamps", () => {
    const srt = buildCaptions(cues, 30, "srt");
    expect(srt).toBe(
      "1\n00:00:00,000 --> 00:00:01,500\nHello world\n\n" +
        "2\n00:00:01,800 --> 00:00:02,800\nSecond line\n",
    );
  });

  it("produces valid WebVTT with the WEBVTT header and dot timestamps", () => {
    const vtt = buildCaptions(cues, 30, "vtt");
    expect(vtt.startsWith("WEBVTT\n\n")).toBe(true);
    expect(vtt).toContain("00:00:00.000 --> 00:00:01.500");
    expect(vtt).toContain("Hello world");
  });

  it("skips empty and zero-length cues", () => {
    const srt = buildCaptions(
      [
        { startFrame: 0, endFrame: 30, text: "keep" },
        { startFrame: 30, endFrame: 30, text: "zero length" },
        { startFrame: 60, endFrame: 90, text: "   " },
      ],
      30,
      "srt",
    );
    expect(srt).toBe("1\n00:00:00,000 --> 00:00:01,000\nkeep\n");
  });

  it("returns just the header for VTT with no usable cues", () => {
    expect(buildCaptions([], 30, "vtt")).toBe("WEBVTT\n\n");
    expect(buildCaptions([], 30, "srt")).toBe("");
  });
});

describe("parseCaptions", () => {
  it("imports SRT into frame-based editable cues", () => {
    expect(
      parseCaptions(
        "1\r\n00:00:00,500 --> 00:00:02,000\r\nHello\r\nworld\r\n",
        30,
        "srt",
      ),
    ).toEqual([{ startFrame: 15, endFrame: 60, text: "Hello world" }]);
  });

  it("imports WebVTT identifiers and timing settings", () => {
    expect(
      parseCaptions(
        "WEBVTT\n\nintro\n00:01.000 --> 00:02.500 align:start\nA clear opening.\n",
        24,
      ),
    ).toEqual([{ startFrame: 24, endFrame: 60, text: "A clear opening." }]);
  });

  it("rejects malformed or reversed cue ranges", () => {
    expect(() =>
      parseCaptions("1\n00:00:03,000 --> 00:00:02,000\nWrong way\n", 30),
    ).toThrow("must end after");
    expect(() => parseCaptions("missing timing", 30)).toThrow(
      "missing a valid time range",
    );
  });
});
