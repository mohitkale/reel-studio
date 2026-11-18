import { describe, expect, it } from "vitest";

import { buildRecordingClipHtml, captionGroups } from "./build-recording-clip";
import { CHARACTERS } from "./presenter/characters";

const words =
  "So this is how the caption lines get broken into short readable groups. Then a new one starts."
    .split(" ")
    .map((text, i) => ({ text, start: i * 0.4, end: i * 0.4 + 0.3 }));

const props = {
  title: "How captions break",
  width: 1080,
  height: 1920,
  fps: 30,
  durationSeconds: 8,
  hasVideo: true,
  reframe: "blur" as const,
  words,
  waveform: [0.2, 0.5, 0.9],
  colors: {
    background: "#101018",
    foreground: "#ffffff",
    accent: "#ffcc00",
    accentForeground: "#101018",
    muted: "#8888aa",
  },
};

describe("recording clip composition", () => {
  it("groups captions into short lines that end at sentence ends", () => {
    const groups = captionGroups(words);
    expect(groups.every((g) => g.length <= 5)).toBe(true);
    expect(
      groups.every(
        (g) => g.map((w) => w.text).join(" ").length <= 28 || g.length === 1,
      ),
    ).toBe(true);
    // The sentence end closes a line.
    const ender = groups.find((g) => g.some((w) => w.text === "groups."))!;
    expect(ender[ender.length - 1]!.text).toBe("groups.");
    expect(groups.flat()).toHaveLength(words.length);
  });

  it("times every word, shows the hook first and owns the audio", () => {
    const html = buildRecordingClipHtml(props);
    expect(html).toContain('data-composition-id="clip"');
    expect(html).toContain('src="audio.wav"');
    expect(html).toContain("How captions break");
    for (let i = 0; i < words.length; i++) expect(html).toContain(`#w-${i}`);
    expect(html).toContain(
      "tl.set('#w-0',{opacity:1,backgroundColor:'#ffcc00',color:'#101018'},0.000)",
    );
    expect(html).toContain('class="clip hook"');
  });

  it("puts landscape video on a blurred copy, and draws a waveform for audio", () => {
    expect(buildRecordingClipHtml(props)).toContain("bgblur");
    expect(buildRecordingClipHtml({ ...props, reframe: "fill" })).not.toContain(
      'class="clip bgblur"',
    );
    const audio = buildRecordingClipHtml({ ...props, hasVideo: false });
    expect(audio).not.toContain("clip.mp4");
    expect(audio).toContain('id="bar-2"');
  });

  it("escapes text and refuses a bad palette", () => {
    const html = buildRecordingClipHtml({
      ...props,
      title: "<script>x</script>",
    });
    expect(html).not.toContain("<script>x</script>");
    expect(() =>
      buildRecordingClipHtml({
        ...props,
        colors: { ...props.colors, accent: "red;}" },
      }),
    ).toThrow(/palette/);
  });
});

describe("recording clip with a presenter", () => {
  const presenter = {
    character: CHARACTERS[0]!,
    placement: "full" as const,
    track: {
      mouth: [{ viseme: "ah" as const, start: 0.2, end: 0.4 }],
      blinks: [],
      accents: [],
    },
  };
  it("shows the presenter instead of the waveform for audio and drives its mouth", () => {
    const html = buildRecordingClipHtml({
      ...props,
      hasVideo: false,
      presenter,
    });
    expect(html).toContain('id="presenter"');
    expect(html).not.toContain('class="wave"');
    expect(html).toContain("tl.set('#pres-mouth-ah',{opacity:1},0.200);");
  });
  it("gives the video its half in a split screen", () => {
    const html = buildRecordingClipHtml({
      ...props,
      presenter: { ...presenter, placement: "split" },
    });
    expect(html).toContain("clip.mp4");
    expect(html).toMatch(
      /\.bgblur,\.main\{left:0px;top:0px;width:1080px;height:960px/,
    );
  });
});
