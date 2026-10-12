import { escapeHtml } from "@/lib/html";
import { colorContrast } from "@/video/readable-palette";
import { formatMotionValue } from "@/production/motion";
import { EXTENSION_MOTION_RECIPES } from "@/video/motion-extensions";
import type { MotionBlockArgs } from "./registered-blocks";

/** Curated native compositions: supplied copy/data only, no remote blocks or generated markup. */
function highlightedCopy({ scene }: MotionBlockArgs): string {
  const phrase = scene.emphasis.find(
    (value) =>
      value.trim().length >= 3 &&
      scene.text.toLowerCase().includes(value.trim().toLowerCase()),
  );
  if (!phrase) return escapeHtml(scene.text);
  const start = scene.text.toLowerCase().indexOf(phrase.trim().toLowerCase());
  const end = start + phrase.trim().length;
  return `${escapeHtml(scene.text.slice(0, start))}<em>${escapeHtml(scene.text.slice(start, end))}</em>${escapeHtml(scene.text.slice(end))}`;
}

function content(args: MotionBlockArgs, id: string): string {
  const { scene } = args;
  const copy = highlightedCopy(args);
  const index = String((scene.order ?? 0) + 1).padStart(2, "0");
  const headline = `<h2 class="am-copy fx-line"><span class="fx-line-inner">${copy}</span></h2>`;
  if (id === "type-spread")
    return `<div class="am-spread"><div class="am-spread-label">${index}</div>${headline}<div class="am-spread-art" aria-hidden="true"><i></i><i></i><i></i></div><div class="am-baseline"></div></div>`;
  if (id === "type-poster")
    return `<div class="am-poster-field"></div><div class="am-poster"><span class="am-index">${index}</span>${headline}<div class="am-baseline"></div></div>`;
  if (id === "type-window")
    return `<div class="am-window"><div class="am-window-corner am-corner-a"></div><div class="am-window-corner am-corner-b"></div>${headline}<div class="am-shutter am-shutter-a"></div><div class="am-shutter am-shutter-b"></div></div>`;
  if (id.startsWith("list-"))
    return `<div class="am-list-content">${headline}<div class="am-items ${id === "list-grid" ? "am-grid" : "am-cascade"}">${scene.items!.map((item, i) => `<div class="am-item"><span class="am-item-index">${String(i + 1).padStart(2, "0")}</span><span class="am-item-copy">${escapeHtml(item)}</span><i aria-hidden="true"></i></div>`).join("")}</div></div>`;
  if (id === "data-ledger") {
    const chart = scene.chart!;
    const series = chart.series[0];
    return `<div class="am-ledger-content">${headline}<div class="am-ledger">${chart.labels.map((label, i) => `<div class="am-cell"><span class="am-cell-label">${escapeHtml(label)}</span><strong class="am-value">${escapeHtml(formatMotionValue(series.values[i], series.unit))}</strong><i aria-hidden="true"></i></div>`).join("")}</div><p class="am-source">${escapeHtml(series.label)}${chart.sourceAttribution ? ` · ${escapeHtml(chart.sourceAttribution)}` : ""}</p></div>`;
  }
  return `<div class="am-gallery-content"><div class="am-gallery-mat"><img src="${escapeHtml(scene.background!.url)}" alt="" draggable="false" /></div><div class="am-gallery-caption"><span class="am-index">${index}</span>${headline}<div class="am-baseline"></div></div></div>`;
}

function render(args: MotionBlockArgs, id: string): string {
  const { scene, tokens } = args;
  const panelInk =
    (colorContrast(tokens.accentForeground, tokens.accent) ?? 0) >= 4.5
      ? tokens.accentForeground
      : (colorContrast("#FFFFFF", tokens.accent) ?? 0) >= 4.5
        ? "#FFFFFF"
        : "#111111";
  return `<section id="scene-${escapeHtml(scene.id)}" class="clip scene motion-scene ${args.transitionClass}"
 data-scene-id="${escapeHtml(scene.id)}" data-motion-recipe="${id}" data-motion-version="1.0.0"
 data-start="${args.absoluteStart.toFixed(3)}" data-duration="${args.duration.toFixed(3)}" data-track-index="1" data-exit-window="${args.exitWindow.toFixed(3)}"
 style="--accent:${escapeHtml(tokens.accent)};--accent-2:${escapeHtml(tokens.accentSecondary)};--panel-ink:${panelInk}">
 <div class="fx-stage am-stage am-${id}${(scene.items?.length ?? 0) > 4 || (scene.items ?? []).join(" ").length > 140 || (scene.chart?.labels.length ?? 0) > 4 ? " am-dense" : ""}" data-motion-scene="${escapeHtml(scene.id)}" data-recipe="${id}" data-design-block="true">${content(args, id)}</div></section>`;
}

const styles = `
.am-stage { container-type:size; color:var(--brand-foreground); background:var(--brand-background); font-family:var(--brand-font); }
.am-stage .ml-ambient, .am-stage .ml-trace { display:none; }
.am-stage .am-copy { margin:0; min-width:0; width:100%; }
.am-stage .am-copy .fx-line-inner { display:block; font-family:var(--brand-font); font-size:clamp(32px,7.6cqw,100px); font-weight:750; letter-spacing:-.045em; line-height:1.12; white-space:normal; overflow-wrap:anywhere; }
.am-copy em { font-style:normal; color:var(--brand-accent-text); }
.am-baseline { height:3px; background:var(--accent); transform-origin:left; }
.am-index, .am-spread-label { color:var(--brand-muted); font-size:clamp(20px,3cqw,38px); line-height:1.2; font-weight:600; font-variant-numeric:tabular-nums; }
.am-spread { position:absolute; inset:var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left); display:grid; grid-template-columns:minmax(0,3fr) minmax(0,1fr); grid-template-rows:auto 1fr auto; gap:clamp(20px,4cqw,50px); align-items:center; }
.am-spread-label { grid-column:1/-1; padding-bottom:24px; border-bottom:2px solid var(--brand-muted); }
.am-spread .am-copy { align-self:center; }
.am-spread-art { height:60%; min-height:130px; display:flex; gap:12%; align-items:stretch; }
.am-spread-art i { display:block; width:24%; background:var(--accent); transform-origin:bottom; }
.am-spread-art i:nth-child(2) { background:var(--accent-2); align-self:center; height:64%; }
.am-spread-art i:nth-child(3) { height:34%; align-self:end; }
.am-spread .am-baseline { grid-column:1/-1; }
.am-poster-field { position:absolute; inset:var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left); background:var(--accent); transform-origin:bottom; }
.am-poster { position:absolute; inset:var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left); padding:clamp(28px,5cqw,72px); display:flex; flex-direction:column; justify-content:space-between; gap:28px; }
.am-poster .am-copy .fx-line-inner { color:var(--panel-ink); font-weight:900; font-size:clamp(40px,10.2cqw,144px); letter-spacing:-.055em; }
.am-poster .am-index, .am-poster .am-copy em { color:var(--panel-ink); }
.am-poster .am-baseline { background:var(--panel-ink); width:32%; height:6px; }
.am-window { position:absolute; inset:calc(var(--safe-top) + 4%) var(--safe-right) calc(var(--safe-bottom) + 4%) var(--safe-left); padding:clamp(28px,5cqw,64px); display:flex; align-items:center; border:2px solid color-mix(in oklab,var(--brand-foreground) 32%,transparent); background:color-mix(in oklab,var(--accent) 10%,var(--brand-background)); overflow:hidden; }
.am-window .am-copy { text-align:center; }
.am-window .am-copy .fx-line-inner { font-size:clamp(34px,7.4cqw,96px); }
.am-window-corner { position:absolute; width:14%; height:12%; border-color:var(--accent); border-style:solid; border-width:0; }
.am-corner-a { left:0; top:0; border-left-width:6px; border-top-width:6px; }
.am-corner-b { right:0; bottom:0; border-right-width:6px; border-bottom-width:6px; }
.am-shutter { position:absolute; top:0; bottom:0; width:50.2%; background:var(--brand-background); z-index:2; }
.am-shutter-a { left:0; transform-origin:left; }
.am-shutter-b { right:0; transform-origin:right; }
.am-list-content, .am-ledger-content { position:absolute; inset:var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left); display:flex; flex-direction:column; justify-content:center; gap:clamp(24px,4cqw,48px); }
.am-list-content .am-copy .fx-line-inner, .am-ledger-content .am-copy .fx-line-inner { font-size:clamp(28px,5.6cqw,70px); }
.am-items { display:grid; gap:clamp(12px,2cqw,24px); }
.am-item { position:relative; display:flex; align-items:center; gap:clamp(18px,3cqw,40px); padding:clamp(18px,3.2cqw,42px); background:color-mix(in oklab,var(--accent) 10%,var(--brand-background)); border-top:2px solid var(--brand-muted); }
.am-item-index { font-size:clamp(16px,2.5cqw,32px); color:var(--brand-accent-text); font-weight:700; }
.am-item-copy { display:block; font-size:clamp(24px,4.4cqw,52px); line-height:1.2; font-weight:600; overflow-wrap:anywhere; }
.am-item i, .am-cell i { position:absolute; bottom:0; left:0; width:100%; height:3px; background:var(--accent); transform-origin:left; }
.am-cascade .am-item:nth-child(even) { margin-left:7%; }
.am-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
.am-grid .am-item { flex-direction:column; align-items:flex-start; justify-content:space-between; min-height:17cqh; gap:16px; }
.am-grid .am-item-copy { font-size:clamp(22px,4cqw,48px); }
.am-ledger { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); border-top:2px solid var(--brand-muted); }
.am-cell { position:relative; min-width:0; padding:clamp(16px,3cqw,36px) 12px; border-bottom:1px solid var(--brand-muted); display:flex; flex-direction:column; gap:clamp(12px,2cqw,24px); }
.am-cell:nth-child(odd) { border-right:1px solid var(--brand-muted); padding-left:0; }
.am-cell:nth-child(even) { padding-left:clamp(16px,3cqw,36px); }
.am-cell-label { font-size:clamp(20px,3.4cqw,40px); line-height:1.2; color:var(--brand-muted); overflow-wrap:anywhere; }
.am-value { display:block; font-size:clamp(34px,7cqw,94px); letter-spacing:-.05em; line-height:1.1; font-weight:750; font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
.am-source { margin:0; font-size:clamp(16px,2.4cqw,28px); color:var(--brand-muted); line-height:1.3; overflow-wrap:anywhere; }
.am-gallery-content { position:absolute; inset:var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left); display:flex; flex-direction:column; justify-content:center; gap:clamp(30px,5cqw,60px); }
.am-gallery-mat { position:relative; height:45%; flex-shrink:0; padding:clamp(14px,3cqw,38px); background:color-mix(in oklab,var(--accent) 16%,var(--brand-background)); border-left:6px solid var(--accent); }
.am-gallery-mat img { display:block; width:100%; height:100%; object-fit:contain; }
.am-gallery-caption { display:flex; flex-direction:column; gap:20px; }
.am-gallery-caption .am-copy .fx-line-inner { font-size:clamp(30px,6cqw,78px); }
.am-dense .am-items { gap:10px; }
.am-dense .am-item { padding:12px 16px; gap:14px; }
.am-dense .am-item-copy { font-size:clamp(22px,3.8cqw,42px); }
@container (min-aspect-ratio:4/5) and (max-aspect-ratio:5/4) {
 .am-dense .am-list-content { gap:16px; }
 .am-dense .am-cascade { gap:6px; }
 .am-dense .am-cascade .am-item { padding:3px 16px; }
 .am-dense .am-grid .am-item { padding:8px 16px; gap:8px; }
 .am-dense .am-ledger-content { gap:12px; }
 .am-dense .am-ledger { grid-template-columns:repeat(3,minmax(0,1fr)); }
 .am-dense .am-cell { padding:6px !important; gap:8px; border-right:1px solid var(--brand-muted); }
 .am-dense .am-cell-label { font-size:20px; }
 .am-dense .am-source { font-size:16px; }
}
@container (min-aspect-ratio:5/4) {
 .am-spread { grid-template-columns:minmax(0,3fr) minmax(0,1fr); }
 .am-spread .am-copy .fx-line-inner { font-size:clamp(32px,5.4cqw,80px); }
 .am-poster .am-copy .fx-line-inner { font-size:clamp(36px,7.2cqw,108px); }
 .am-window { inset:var(--safe-top) calc(var(--safe-right) + 4%) var(--safe-bottom) calc(var(--safe-left) + 4%); }
 .am-window .am-copy .fx-line-inner { font-size:clamp(32px,5.4cqw,80px); }
 .am-list-content, .am-ledger-content { gap:20px; }
 .am-list-content .am-copy .fx-line-inner, .am-ledger-content .am-copy .fx-line-inner { font-size:clamp(28px,3.6cqw,52px); }
 .am-cascade { gap:10px; }
 .am-cascade .am-item { padding:10px 24px; }
 .am-item-copy { font-size:clamp(22px,2.8cqw,40px); }
 .am-grid { grid-template-columns:repeat(4,minmax(0,1fr)); }
 .am-grid .am-item { padding:20px; min-height:25cqh; }
 .am-grid .am-item-copy { font-size:clamp(22px,2.8cqw,40px); }
 .am-ledger { grid-template-columns:repeat(3,minmax(0,1fr)); }
 .am-cell { padding:16px !important; border-right:1px solid var(--brand-muted); }
 .am-cell-label { font-size:clamp(20px,2.6cqw,32px); }
 .am-value { font-size:clamp(32px,5.2cqw,72px); }
 .am-source { font-size:clamp(16px,2cqw,24px); }
 .am-gallery-content { flex-direction:row; align-items:center; gap:5%; }
 .am-gallery-mat { width:55%; height:90%; }
 .am-gallery-caption { width:40%; }
 .am-gallery-caption .am-copy .fx-line-inner { font-size:clamp(28px,4.4cqw,60px); }
}
`;

export const DESIGN_MOTION_BLOCKS = EXTENSION_MOTION_RECIPES.slice(1).map(
  (recipe) => ({
    recipe,
    render: (args: MotionBlockArgs) => render(args, recipe.id),
    styles,
  }),
);

/** Injected into the existing per-scene paused GSAP timeline. No callbacks, clocks or DOM measurements. */
export const DESIGN_MOTION_BOOT = `
if (stage.hasAttribute('data-design-block')) {
 var designCopy = stage.querySelector('.fx-line-inner');
 var poster = recipe === 'type-poster';
 if (designCopy) tl.fromTo(designCopy, { opacity:0, x:recipe === 'type-spread' ? -32 : 0, y:poster ? 24 : 0, scale:poster ? 1.08 : 1 }, { opacity:1, x:0, y:0, scale:1, duration:poster ? .55 : .6, ease:poster ? 'power4.out' : 'power2.out' }, events.reveal);
 var field = stage.querySelector('.am-poster-field');
 if (field) tl.fromTo(field, { scaleY:.04 }, { scaleY:1, duration:.62, ease:'power4.inOut' }, 0);
 stage.querySelectorAll('.am-spread-art i').forEach(function(el,i) { tl.fromTo(el,{scaleY:0},{scaleY:1,duration:.7,ease:'power3.inOut'}, .08+i*.12); });
 stage.querySelectorAll('.am-baseline,.am-item i,.am-cell i').forEach(function(el,i) { tl.fromTo(el,{scaleX:0},{scaleX:1,duration:.5,ease:'power3.out'}, .62+i*.07); });
 stage.querySelectorAll('.am-window-corner').forEach(function(el,i) { tl.fromTo(el,{opacity:0,x:i ? 18 : -18,y:i ? 18 : -18},{opacity:1,x:0,y:0,duration:.6,ease:'power3.out'}, .16); });
 stage.querySelectorAll('.am-shutter').forEach(function(el) { tl.fromTo(el,{scaleX:1},{scaleX:0,duration:.7,ease:'power3.inOut'}, .02); });
 stage.querySelectorAll('.am-item,.am-cell').forEach(function(el,i) { tl.fromTo(el,{opacity:0,x:recipe === 'list-grid' ? (i % 2 ? 24 : -24) : 0,y:recipe === 'list-cascade' ? 30 : 14},{opacity:1,x:0,y:0,duration:.5,ease:'power3.out'}, .2+i*.12); });
 var mat = stage.querySelector('.am-gallery-mat');
 if (mat) tl.fromTo(mat,{opacity:0,x:-28,rotation:-3},{opacity:1,x:0,rotation:0,duration:.8,ease:'power3.out'}, .02);
}
`;
