import type { Accent, Blink, MouthKey } from "@/video/visemes";

import { characterSvg, type Character } from "./characters";

/**
 * Puts a presenter into a HyperFrames composition (roadmap P1). The rig is one
 * inline SVG; its mouth, eyes, brows and head are driven by `set` and `to`
 * calls on the composition's own paused GSAP timeline, so every frame is the
 * same on every render.
 */
export type PresenterPlacement = "full" | "corner" | "split";
export const PRESENTER_PLACEMENTS: readonly PresenterPlacement[] = [
  "full",
  "corner",
  "split",
];

export interface PresenterTrack {
  mouth: MouthKey[];
  blinks: Blink[];
  accents: Accent[];
}

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PresenterLayout {
  presenter: Box;
  /** Where the speaker's own video goes when there is one. Undefined: full frame. */
  video?: Box;
  /** Top of the caption block as a percentage of the frame height. */
  captionTop: number;
  circle: boolean;
}

const RIG_ASPECT = 400 / 500;

function fit(box: Box): Box {
  // The rig keeps its proportions inside the box and sits on its bottom edge.
  const width = Math.min(box.width, box.height * RIG_ASPECT);
  const height = width / RIG_ASPECT;
  return {
    left: box.left + (box.width - width) / 2,
    top: box.top + box.height - height,
    width,
    height,
  };
}

/** Where the presenter, the video and the captions go for a placement and frame size. */
export function presenterLayout(
  placement: PresenterPlacement,
  frame: { width: number; height: number },
): PresenterLayout {
  const { width: w, height: h } = frame;
  const portrait = h > w;
  if (placement === "corner") {
    const size = portrait ? w * 0.36 : h * 0.34;
    return {
      presenter: portrait
        ? { left: w * 0.6, top: h * 0.22, width: size, height: size }
        : {
            left: w - size - w * 0.04,
            top: h * 0.1,
            width: size,
            height: size,
          },
      captionTop: portrait ? 62 : 74,
      circle: true,
    };
  }
  if (placement === "split") {
    return portrait
      ? {
          video: { left: 0, top: 0, width: w, height: h * 0.5 },
          presenter: fit({ left: 0, top: h * 0.5, width: w, height: h * 0.5 }),
          captionTop: 47,
          circle: false,
        }
      : {
          video: { left: 0, top: 0, width: w * 0.5, height: h },
          presenter: fit({ left: w * 0.5, top: 0, width: w * 0.5, height: h }),
          captionTop: 72,
          circle: false,
        };
  }
  return {
    presenter: fit(
      portrait
        ? { left: w * 0.05, top: h * 0.14, width: w * 0.9, height: h * 0.6 }
        : { left: w * 0.2, top: h * 0.08, width: w * 0.6, height: h * 0.78 },
    ),
    captionTop: portrait ? 72 : 76,
    circle: false,
  };
}

export interface BuiltPresenter {
  html: string;
  css: string;
  /** Statements for the composition's timeline `tl`. */
  script: string;
  layout: PresenterLayout;
}

const t3 = (n: number) => n.toFixed(3);

export function buildPresenter(options: {
  character: Character;
  placement: PresenterPlacement;
  frame: { width: number; height: number };
  seconds: number;
  track: PresenterTrack;
}): BuiltPresenter {
  const { character: c, track } = options;
  const layout = presenterLayout(options.placement, options.frame);
  const box = layout.presenter;
  const px = (n: number) => `${Math.round(n)}px`;
  const css = `.presenter{position:absolute;left:${px(box.left)};top:${px(box.top)};width:${px(box.width)};height:${px(box.height)};z-index:5}${
    layout.circle
      ? `.presenter.corner{border-radius:50%;overflow:hidden;background:${c.accent};box-shadow:0 0 0 ${Math.max(6, Math.round(box.width * 0.035))}px ${c.accent},0 12px 32px #0008}.presenter.corner .presenter-svg{transform:scale(1.18) translateY(7%)}`
      : ""
  }.presenter-svg{display:block;width:100%;height:100%;overflow:visible}`;
  const html = `<div id="presenter" class="presenter ${options.placement}" data-layout-allow-overlap>${characterSvg(c)}</div>`;

  const lines: string[] = [];
  // Mouth: hide the shape that was showing and show the next one.
  let current = "rest";
  for (const key of track.mouth) {
    if (key.viseme === current) continue;
    lines.push(
      `tl.set('#pres-mouth-${current}',{opacity:0},${t3(key.start)});`,
      `tl.set('#pres-mouth-${key.viseme}',{opacity:1},${t3(key.start)});`,
    );
    current = key.viseme;
  }
  for (const blink of track.blinks)
    lines.push(
      `tl.set('#pres-eyes-open',{opacity:0},${t3(blink.start)});`,
      `tl.set('#pres-eyes-closed',{opacity:1},${t3(blink.start)});`,
      `tl.set('#pres-eyes-open',{opacity:1},${t3(blink.end)});`,
      `tl.set('#pres-eyes-closed',{opacity:0},${t3(blink.end)});`,
    );
  for (const accent of track.accents) {
    if (accent.kind === "nod")
      lines.push(
        `tl.to('#pres-head',{y:12,duration:.12,ease:'power2.out'},${t3(accent.at)});`,
        `tl.to('#pres-head',{y:0,duration:.24,ease:'power2.inOut'},${t3(accent.at + 0.12)});`,
      );
    else
      lines.push(
        `tl.to('#pres-brows',{y:-13,duration:.15,ease:'power2.out'},${t3(accent.at)});`,
        `tl.to('#pres-brows',{y:0,duration:.3,ease:'power2.inOut'},${t3(accent.at + 0.9)});`,
      );
  }
  // Idle sway: the head tips a degree one way, then the other, every couple of seconds.
  let sway = 0;
  for (let at = 0; at < options.seconds; at += 2.4) {
    sway = sway === 1.1 ? -1.1 : 1.1;
    lines.push(
      `tl.to('#pres-head',{rotation:${sway},svgOrigin:'200 380',duration:2.4,ease:'sine.inOut'},${t3(at)});`,
    );
  }
  return { html, css, script: lines.join("\n"), layout };
}
