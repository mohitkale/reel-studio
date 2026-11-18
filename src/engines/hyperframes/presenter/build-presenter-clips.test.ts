import { describe, expect, it } from "vitest";

import { PRESENTER_CHARACTER_IDS } from "@/video/presenter-config";

import { buildPresenterClips, onSpans } from "./build-presenter-clips";
import { CHARACTERS, characterLayer } from "./characters";

const mouth = [
  { viseme: "rest" as const, start: 0, end: 1 },
  { viseme: "ah" as const, start: 1, end: 1.4 },
  { viseme: "mbp" as const, start: 1.4, end: 3 },
];
const frame = { width: 1080, height: 1920 };

describe("presenter ids", () => {
  it("match the characters in the rig", () => {
    expect([...PRESENTER_CHARACTER_IDS].sort()).toEqual(
      CHARACTERS.map((c) => c.id).sort(),
    );
  });
});

describe("presenter spans", () => {
  it("is on everywhere except the scenes that turn it off", () => {
    expect(onSpans(10, [])).toEqual([{ start: 0, end: 10 }]);
    expect(onSpans(10, [{ start: 3, end: 5 }])).toEqual([
      { start: 0, end: 3 },
      { start: 5, end: 10 },
    ]);
    expect(
      onSpans(10, [
        { start: 0, end: 4 },
        { start: 8, end: 10 },
      ]),
    ).toEqual([{ start: 4, end: 8 }]);
  });
});

describe("presenter clips for a storyboard video", () => {
  const args = {
    character: CHARACTERS[0]!,
    placement: "corner" as const,
    frame,
    total: 3,
    mouth,
    blinks: [{ start: 2, end: 2.14 }],
  };

  it("shows one mouth at a time as timed clips", () => {
    const { html } = buildPresenterClips(args);
    const mouths = [
      ...html.matchAll(
        /data-track-index="31" data-start="?|data-start="([\d.]+)" data-duration="([\d.]+)" data-track-index="31"/g,
      ),
    ];
    expect(mouths).toHaveLength(3);
    expect(html).toContain(
      'data-start="1.000" data-duration="0.400" data-track-index="31"',
    );
    expect(html.match(/data-track-index="30"/g)).toHaveLength(1);
    expect(html.match(/data-track-index="32"/g)).toHaveLength(1);
    expect(html).toContain("clip presenter-stage-p");
  });

  it("drops everything while a scene turns the presenter off", () => {
    const { html } = buildPresenterClips({
      ...args,
      off: [{ start: 1, end: 2 }],
    });
    // The base is cut in two, and the mouth "ah" (1.0 to 1.4) is gone.
    expect(html.match(/data-track-index="30"/g)).toHaveLength(2);
    expect(html).not.toContain('data-start="1.000" data-duration="0.400"');
    // The blink at 2.0 is after the gap, so it stays.
    expect(html.match(/data-track-index="32"/g)).toHaveLength(1);
  });

  it("covers the whole video with a mouth, filling gaps with rest", () => {
    const { html } = buildPresenterClips({
      ...args,
      mouth: [{ viseme: "ah", start: 1, end: 1.4 }],
    });
    const mouths = [
      ...html.matchAll(
        /data-start="([\d.]+)" data-duration="([\d.]+)" data-track-index="31"/g,
      ),
    ];
    const total = mouths.reduce((sum, m) => sum + Number(m[2]), 0);
    expect(total).toBeCloseTo(3, 2);
    expect(mouths).toHaveLength(3);
  });

  it("drops the head for a moment on a nod, moving the face with it", () => {
    const { html } = buildPresenterClips({ ...args, nods: [1.1] });
    expect(html).toContain('<g id="pres-head-p1" transform="translate(0 11)">');
    expect(html).toContain('<g transform="translate(0 11)">');
    // The base is cut at the start and the end of the nod: three pieces.
    expect(html.match(/data-track-index="30"/g)).toHaveLength(3);
  });

  it("puts two presenters in one frame with their own ids", () => {
    const a = buildPresenterClips({
      ...args,
      uid: "a",
      box: { left: 0, top: 800, width: 400, height: 500 },
    });
    const b = buildPresenterClips({
      ...args,
      character: CHARACTERS[1]!,
      uid: "b",
      box: { left: 600, top: 800, width: 400, height: 500 },
    });
    const ids = [...(a.html + b.html).matchAll(/ id="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(a.css).toContain("left:0px");
    expect(b.css).toContain("left:600px");
  });

  it("keeps gradient ids unique across the cut bases and shapes the corner bubble round", () => {
    const orb = CHARACTERS.find((c) => c.style === "3d")!;
    const { html, css } = buildPresenterClips({
      ...args,
      character: orb,
      off: [{ start: 1, end: 2 }],
    });
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(css).toContain("border-radius:50%");
  });

  it("draws layers with no script and no ids that could clash", () => {
    for (const c of CHARACTERS) {
      for (const layer of ["blink", "ah", "mbp"] as const) {
        const svg = characterLayer(c, layer);
        expect(svg).not.toContain("<script");
        expect(svg).not.toMatch(/ id="/);
      }
    }
  });
});
