import { describe, expect, it } from "vitest";

import { VISEMES } from "@/video/visemes";

import {
  buildPresenter,
  presenterLayout,
  PRESENTER_PLACEMENTS,
} from "./build-presenter";
import {
  CHARACTERS,
  characterSvg,
  getCharacter,
  mouthShape,
} from "./characters";

const track = {
  mouth: [
    { viseme: "rest" as const, start: 0, end: 0.3 },
    { viseme: "ah" as const, start: 0.3, end: 0.5 },
    { viseme: "mbp" as const, start: 0.5, end: 0.6 },
  ],
  blinks: [{ start: 1.2, end: 1.34 }],
  accents: [
    { at: 0.8, kind: "nod" as const },
    { at: 2, kind: "brows" as const },
  ],
};

describe("presenter characters", () => {
  it("has six characters across four styles, each with a default voice and a unique id", () => {
    expect(CHARACTERS).toHaveLength(6);
    expect(new Set(CHARACTERS.map((c) => c.id)).size).toBe(6);
    expect(new Set(CHARACTERS.map((c) => c.style))).toEqual(
      new Set(["flat", "line", "3d", "mascot"]),
    );
    for (const c of CHARACTERS) expect(c.voiceId).toMatch(/^[a-z]{2}_[a-z]+$/);
    expect(getCharacter("maya")?.name).toBe("Maya");
    expect(getCharacter("nobody")).toBeUndefined();
  });

  it("draws every named part and all twelve mouth shapes for every character", () => {
    for (const c of CHARACTERS) {
      const svg = characterSvg(c);
      for (const id of [
        "pres-head",
        "pres-eyes-open",
        "pres-eyes-closed",
        "pres-brows",
        "pres-face",
      ])
        expect(svg).toContain(`id="${id}"`);
      for (const v of VISEMES) {
        expect(svg).toContain(`id="pres-mouth-${v}"`);
        expect(mouthShape(v, c).length).toBeGreaterThan(20);
      }
      // Only the resting mouth shows at first, and every id is unique.
      expect(svg).toContain('id="pres-mouth-rest" opacity="1"');
      const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("draws different mouths for different sounds", () => {
    const c = CHARACTERS[0]!;
    const shapes = VISEMES.map((v) => mouthShape(v, c));
    expect(new Set(shapes).size).toBe(12);
  });
});

describe("presenter layout and timeline", () => {
  it("places the presenter inside the frame for every placement and format", () => {
    for (const frame of [
      { width: 1080, height: 1920 },
      { width: 1920, height: 1080 },
      { width: 1080, height: 1080 },
    ])
      for (const placement of PRESENTER_PLACEMENTS) {
        const { presenter, captionTop } = presenterLayout(placement, frame);
        expect(presenter.left).toBeGreaterThanOrEqual(0);
        expect(presenter.top).toBeGreaterThanOrEqual(0);
        expect(presenter.left + presenter.width).toBeLessThanOrEqual(
          frame.width + 1,
        );
        expect(presenter.top + presenter.height).toBeLessThanOrEqual(
          frame.height + 1,
        );
        expect(captionTop).toBeGreaterThan(30);
      }
  });

  it("gives the video its own half in a split", () => {
    const portrait = presenterLayout("split", { width: 1080, height: 1920 });
    expect(portrait.video).toMatchObject({ top: 0, height: 960 });
    const wide = presenterLayout("split", { width: 1920, height: 1080 });
    expect(wide.video).toMatchObject({ left: 0, width: 960 });
    expect(
      presenterLayout("full", { width: 1080, height: 1920 }).video,
    ).toBeUndefined();
  });

  it("writes the timeline: one mouth change at a time, blinks, nods and sway", () => {
    const built = buildPresenter({
      character: CHARACTERS[1]!,
      placement: "corner",
      frame: { width: 1080, height: 1920 },
      seconds: 5,
      track,
    });
    expect(built.script).toContain(
      "tl.set('#pres-mouth-rest',{opacity:0},0.300);",
    );
    expect(built.script).toContain(
      "tl.set('#pres-mouth-ah',{opacity:1},0.300);",
    );
    expect(built.script).toContain(
      "tl.set('#pres-mouth-ah',{opacity:0},0.500);",
    );
    expect(built.script).toContain(
      "tl.set('#pres-eyes-closed',{opacity:1},1.200);",
    );
    expect(built.script).toContain("tl.to('#pres-head',{y:12");
    expect(built.script).toContain("tl.to('#pres-brows',{y:-13");
    expect(built.script).toContain("rotation:1.1");
    expect(built.script).toContain("rotation:-1.1");
    expect(built.css).toContain("border-radius:50%");
    expect(built.html).toContain('class="presenter corner"');
  });

  it("is deterministic", () => {
    const args = {
      character: CHARACTERS[0]!,
      placement: "full" as const,
      frame: { width: 1080, height: 1920 },
      seconds: 5,
      track,
    };
    expect(buildPresenter(args)).toEqual(buildPresenter(args));
  });
});
