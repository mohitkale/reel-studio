import { characterLayer, type Character } from "./characters";
import { presenterLayout, type PresenterPlacement } from "./build-presenter";
import type { Blink, MouthKey } from "@/video/visemes";

/**
 * The presenter for a storyboard video (roadmap P1). The main composition shows
 * and hides elements by their own time attributes, so the presenter is built
 * the same way: a still body and face, a blink overlay and one mouth overlay at a
 * time, each a `clip` with a start and duration. No script drives it, which
 * keeps every frame the same on every render. Nods and sway are not drawn here
 * (they need a script timeline); the recording clips have them.
 */
export interface PresenterSpan {
  start: number;
  end: number;
}

const t3 = (n: number) => n.toFixed(3);

/** Time ranges the presenter is on: the whole video minus the scenes that turn it off. */
export function onSpans(
  total: number,
  off: readonly PresenterSpan[],
): PresenterSpan[] {
  const sorted = [...off].sort((a, b) => a.start - b.start);
  const out: PresenterSpan[] = [];
  let cursor = 0;
  for (const span of sorted) {
    if (span.start > cursor)
      out.push({ start: cursor, end: Math.min(span.start, total) });
    cursor = Math.max(cursor, span.end);
  }
  if (cursor < total) out.push({ start: cursor, end: total });
  return out.filter((s) => s.end - s.start > 0.05);
}

/** The parts of [start, end] that fall inside any of the ranges. */
function within(start: number, end: number, spans: readonly PresenterSpan[]) {
  return spans.flatMap((span) => {
    const a = Math.max(start, span.start);
    const b = Math.min(end, span.end);
    return b - a > 0.02 ? [{ start: a, end: b }] : [];
  });
}

export function buildPresenterClips(options: {
  character: Character;
  placement: Exclude<PresenterPlacement, "split">;
  frame: { width: number; height: number };
  /** Seconds the whole video lasts. */
  total: number;
  mouth: readonly MouthKey[];
  blinks: readonly Blink[];
  off?: readonly PresenterSpan[];
}): { html: string; css: string } {
  const { character: c } = options;
  const layout = presenterLayout(options.placement, options.frame);
  const box = layout.presenter;
  const px = (n: number) => `${Math.round(n)}px`;
  const circle = layout.circle;
  const css = `.presenter-stage{position:absolute;left:${px(box.left)};top:${px(box.top)};width:${px(box.width)};height:${px(box.height)};z-index:40;pointer-events:none}${
    circle
      ? `.presenter-stage.corner{border-radius:50%;overflow:hidden;background:${c.accent};box-shadow:0 0 0 ${Math.max(6, Math.round(box.width * 0.035))}px ${c.accent},0 12px 32px #0008}.presenter-stage.corner .presenter-svg{transform:scale(1.18) translateY(7%)}`
      : ""
  }.presenter-stage.presenter-overlay{background:none;box-shadow:none}.presenter-stage .presenter-svg{position:absolute;inset:0;display:block;width:100%;height:100%;overflow:visible}`;
  const spans = onSpans(options.total, options.off ?? []);
  const layers: string[] = [];
  const clip = (
    inner: string,
    start: number,
    end: number,
    track: number,
    overlay = false,
  ) =>
    `<div class="clip presenter-stage${overlay ? " presenter-overlay" : ""} ${options.placement}" data-layout-allow-overlap data-start="${t3(start)}" data-duration="${t3(end - start)}" data-track-index="${track}">${inner}</div>`;
  spans.forEach((span, index) => {
    layers.push(
      clip(characterLayer(c, "base", String(index)), span.start, span.end, 30),
    );
  });
  for (const key of options.mouth)
    for (const part of within(key.start, key.end, spans))
      layers.push(
        clip(characterLayer(c, key.viseme), part.start, part.end, 31, true),
      );
  for (const blink of options.blinks)
    for (const part of within(blink.start, blink.end, spans))
      layers.push(
        clip(characterLayer(c, "blink"), part.start, part.end, 32, true),
      );
  return { html: layers.join("\n"), css };
}
