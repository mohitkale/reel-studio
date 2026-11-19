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

/** The mouth keys with rest filling every gap, from 0 to `total`, so a mouth is always showing. */
export function coverMouth(
  mouth: readonly MouthKey[],
  total: number,
): MouthKey[] {
  const out: MouthKey[] = [];
  let cursor = 0;
  for (const key of [...mouth].sort((a, b) => a.start - b.start)) {
    if (key.start > cursor + 0.01)
      out.push({ viseme: "rest", start: cursor, end: key.start });
    out.push(key);
    cursor = Math.max(cursor, key.end);
  }
  if (cursor < total) out.push({ viseme: "rest", start: cursor, end: total });
  return out;
}

const NOD_SECONDS = 0.28;
const NOD_DROP = 11;

export function buildPresenterClips(options: {
  character: Character;
  placement: Exclude<PresenterPlacement, "split">;
  frame: { width: number; height: number };
  /** Seconds the whole video lasts. */
  total: number;
  mouth: readonly MouthKey[];
  blinks: readonly Blink[];
  /** Times of head nods: the head drops a little for a moment. */
  nods?: readonly number[];
  off?: readonly PresenterSpan[];
  /** Put the presenter here instead of where the placement says (two presenters share a frame). */
  box?: { left: number; top: number; width: number; height: number };
  /** Keeps ids unique when more than one presenter is in the page. */
  uid?: string;
  /** Round bubble for the box; the default follows the placement. */
  circle?: boolean;
}): { html: string; css: string } {
  const { character: c } = options;
  const layout = presenterLayout(options.placement, options.frame);
  const box = options.box ?? layout.presenter;
  const px = (n: number) => `${Math.round(n)}px`;
  const circle = options.circle ?? layout.circle;
  const uid = options.uid ?? "p";
  const stage = `presenter-stage-${uid}`;
  const css = `.${stage}{position:absolute;left:${px(box.left)};top:${px(box.top)};width:${px(box.width)};height:${px(box.height)};z-index:40;pointer-events:none}${
    circle
      ? `.${stage}.bubble{border-radius:50%;overflow:hidden;background:${c.accent};box-shadow:0 0 0 ${Math.max(6, Math.round(box.width * 0.035))}px ${c.accent},0 12px 32px #0008}.${stage}.bubble .presenter-svg{transform:scale(1.18) translateY(7%)}`
      : ""
  }.${stage}.presenter-overlay{background:none;box-shadow:none}.${stage} .presenter-svg{position:absolute;inset:0;display:block;width:100%;height:100%;overflow:visible}`;
  const spans = onSpans(options.total, options.off ?? []);
  const nods = [...(options.nods ?? [])].sort((a, b) => a - b);
  /** Is a nod under way at these times? Returns the nod that covers [start, end], if any. */
  const nodAt = (start: number, end: number) =>
    nods.some((n) => start < n + NOD_SECONDS && end > n);
  const layers: string[] = [];
  const clip = (
    inner: string,
    start: number,
    end: number,
    track: number,
    overlay = false,
  ) =>
    `<div class="clip ${stage}${circle ? " bubble" : ""}${overlay ? " presenter-overlay" : ""}" data-presenter-clip data-layout-allow-overlap data-start="${t3(start)}" data-duration="${t3(end - start)}" data-track-index="${track}">${inner}</div>`;
  let baseIndex = 0;
  // The still face is cut at every nod so the head can drop for a moment.
  for (const span of spans) {
    const cuts = [span.start];
    for (const n of nods)
      for (const edge of [n, n + NOD_SECONDS])
        if (edge > span.start + 0.02 && edge < span.end - 0.02) cuts.push(edge);
    cuts.push(span.end);
    const sorted = [...new Set(cuts)].sort((a, b) => a - b);
    for (let i = 0; i + 1 < sorted.length; i++) {
      const [a, b] = [sorted[i]!, sorted[i + 1]!];
      const dy = nodAt(a, b) ? NOD_DROP : 0;
      layers.push(
        clip(characterLayer(c, "base", `${uid}${baseIndex++}`, dy), a, b, 30),
      );
    }
  }
  /** A layer is split at nod edges so its shift matches the head. */
  const split = (start: number, end: number) => {
    const edges = [start, end];
    for (const n of nods)
      for (const edge of [n, n + NOD_SECONDS])
        if (edge > start + 0.02 && edge < end - 0.02) edges.push(edge);
    const sorted = [...new Set(edges)].sort((x, y) => x - y);
    return sorted.slice(0, -1).map((a, i) => ({
      start: a,
      end: sorted[i + 1]!,
      dy: nodAt(a, sorted[i + 1]!) ? NOD_DROP : 0,
    }));
  };
  for (const key of coverMouth(options.mouth, options.total))
    for (const part of within(key.start, key.end, spans))
      for (const piece of split(part.start, part.end))
        layers.push(
          clip(
            characterLayer(c, key.viseme, uid, piece.dy),
            piece.start,
            piece.end,
            31,
            true,
          ),
        );
  for (const blink of options.blinks)
    for (const part of within(blink.start, blink.end, spans))
      for (const piece of split(part.start, part.end))
        layers.push(
          clip(
            characterLayer(c, "blink", uid, piece.dy),
            piece.start,
            piece.end,
            32,
            true,
          ),
        );
  return { html: layers.join("\n"), css };
}
