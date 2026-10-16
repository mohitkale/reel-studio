import { escapeHtml } from "@/lib/html";
import { resolveAdaptiveLayout } from "@/production/adaptive-layout";
import type { MotionBlockArgs } from "./registered-blocks";

export function buildAdaptiveScene(
  args: MotionBlockArgs,
  width: number,
  height: number,
  contentDuration: number,
): string | null {
  const { scene } = args;
  const { plan } = resolveAdaptiveLayout(scene, width, height, contentDuration);
  if (!plan) return null;
  const box = (b: {
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
  }) =>
    `left:${b.x}px;top:${b.y}px;width:${b.width}px;height:${b.height}px;font-size:${b.fontSize}px`;
  const chart = scene.chart,
    series = chart?.series[0];
  const max = series ? Math.max(...series.values, 1) : 1;
  const panels = plan.panels
    .map((p) => {
      let content = "";
      if (plan.recipeId === "adaptive-media")
        content = `<img class="ar-image" src="${escapeHtml(scene.background!.url)}" alt="" draggable="false"/>`;
      else if (chart && series) {
        const value = series.values[p.index];
        content = `<div class="ar-evidence"><span class="ar-label">${escapeHtml(chart.labels[p.index])}</span><strong>${escapeHtml(String(value))}<small>${escapeHtml(series.unit ?? "")}</small></strong></div>${plan.variant === "bars" ? `<div class="ar-bar-track"><i class="ar-bar" style="width:${(value / max) * 100}%"></i></div>` : ""}`;
      } else
        content = `<span class="ar-number">${String(p.index + 1).padStart(2, "0")}</span><div class="ar-copy">${escapeHtml(scene.items![p.index])}</div>`;
      return `<div class="ar-panel" data-at="${p.at}" data-focus="${p.focus}" style="${box(p)}">${content}<i class="ar-focus-line" aria-hidden="true"></i></div>`;
    })
    .join("");
  const connections =
    plan.recipeId === "adaptive-process"
      ? `<svg class="ar-connections" viewBox="0 0 ${width} ${height}" aria-hidden="true">${plan.panels
          .slice(1)
          .map((p, i) => {
            const prev = plan.panels[i];
            // Only connect adjacent edges through the gutter. A row wrap starts
            // a new numbered run rather than drawing through other subjects.
            const horizontal = p.y === prev.y;
            const vertical = p.x === prev.x;
            if (!horizontal && !vertical) return "";
            const startX = horizontal
              ? prev.x + prev.width
              : prev.x + prev.width / 2;
            const startY = horizontal
              ? prev.y + prev.height / 2
              : prev.y + prev.height;
            const endX = horizontal ? p.x : p.x + p.width / 2;
            const endY = horizontal ? p.y + p.height / 2 : p.y;
            return `<path data-focus="${p.focus}" pathLength="1" d="M${startX} ${startY} L${endX} ${endY}"/>`;
          })
          .join("")}</svg>`
      : "";
  const source =
    plan.source && series
      ? `<div class="ar-source" style="${box(plan.source)}">${escapeHtml(series.label)}${chart?.sourceAttribution ? ` · ${escapeHtml(chart.sourceAttribution)}` : ""}</div>`
      : "";
  return `<section id="scene-${escapeHtml(scene.id)}" class="clip scene motion-scene ${args.transitionClass}" data-scene-id="${escapeHtml(scene.id)}" data-motion-recipe="${plan.recipeId}" data-motion-version="1.0.0" data-start="${args.absoluteStart.toFixed(3)}" data-duration="${args.duration.toFixed(3)}" data-track-index="1" data-exit-window="${args.exitWindow.toFixed(3)}"><div class="fx-stage ar-stage ar-${plan.system} ar-${plan.variant}" data-motion-scene="${escapeHtml(scene.id)}" data-recipe="${plan.recipeId}" data-adaptive="1" data-entrance="${plan.entrance}" data-content-duration="${contentDuration}" style="--ar-scale:${Math.min(width, height) / 1080};--accent:${escapeHtml(args.tokens.accent)};--accent-2:${escapeHtml(args.tokens.accentSecondary)}"><div class="ar-atmosphere" aria-hidden="true"></div><h2 class="ar-headline" style="${box(plan.headline)}">${escapeHtml(scene.text)}</h2>${connections}${panels}${source}<div class="ar-rule" aria-hidden="true"></div></div></section>`;
}
export const ADAPTIVE_STYLES = `
.ar-stage{background:var(--brand-background);color:var(--brand-foreground);font-family:var(--brand-font);container-type:size;}
.ar-stage *{box-sizing:border-box;}
.ar-atmosphere{position:absolute;inset:0;background:radial-gradient(ellipse at 90% 15%,color-mix(in srgb,var(--accent) 15%,transparent),transparent 65%);}
.ar-headline{position:absolute;margin:0;display:flex;align-items:center;font-weight:740;line-height:1.18;letter-spacing:-.035em;overflow-wrap:anywhere;white-space:pre-wrap;}
.ar-panel{position:absolute;display:flex;align-items:center;gap:calc(24px * var(--ar-scale));padding:calc(28px * var(--ar-scale));border:1px solid color-mix(in srgb,var(--brand-foreground) 25%,transparent);border-radius:var(--motion-radius);background:color-mix(in srgb,var(--brand-background) 94%,var(--accent));line-height:1.22;overflow-wrap:anywhere;}
.ar-focus-line{position:absolute;bottom:0;left:0;right:0;height:calc(4px * var(--ar-scale));background:var(--accent);transform-origin:left;}
.ar-connections{position:absolute;inset:0;width:100%;height:100%;fill:none;stroke:var(--accent);stroke-width:4;opacity:.6;}
.ar-panel .ar-copy{min-width:0;flex:1;font-weight:650;}
.ar-number{align-self:flex-start;font-size:calc(22px * var(--ar-scale));font-variant-numeric:tabular-nums;color:var(--brand-accent-text);font-weight:600;}
.ar-columns .ar-panel,.ar-grid .ar-panel,.ar-route .ar-panel{flex-direction:column;justify-content:center;align-items:flex-start;}
.ar-columns .ar-copy,.ar-grid .ar-copy,.ar-route .ar-copy{flex:0;}
.ar-route .ar-panel{border-top:calc(4px * var(--ar-scale)) solid var(--accent);}

.ar-evidence{width:100%;display:flex;justify-content:space-between;align-items:center;gap:calc(22px * var(--ar-scale));}
.ar-evidence strong{font-size:1.2em;font-variant-numeric:tabular-nums;white-space:nowrap;}
.ar-evidence small{font-size:.6em;font-weight:500;margin-left:.2em;}
.ar-metric .ar-evidence{flex-direction:column;align-items:flex-start;}
.ar-bars .ar-panel{flex-direction:column;justify-content:center;gap:calc(16px * var(--ar-scale));}
.ar-bar-track{width:100%;height:calc(10px * var(--ar-scale));background:color-mix(in srgb,var(--brand-foreground) 10%,transparent);}
.ar-bar{display:block;height:100%;background:var(--accent);transform-origin:left;}
.ar-image{width:100%;height:100%;object-fit:contain;}
.ar-source{position:absolute;display:flex;align-items:center;line-height:1.22;overflow-wrap:anywhere;color:var(--brand-muted);}
.ar-rule{position:absolute;bottom:var(--safe-bottom);left:var(--safe-left);width:12%;height:calc(3px * var(--ar-scale));background:var(--accent);transform-origin:left;}
.ar-focus .ar-headline{border-left:calc(5px * var(--ar-scale)) solid var(--accent);padding-left:calc(28px * var(--ar-scale));}
.ar-reading .ar-headline{font-weight:500;line-height:1.22;letter-spacing:-.015em;}
.ar-editorial .ar-panel{border-radius:0;border-width:0 0 1px;background:transparent;}
.ar-editorial .ar-headline{font-weight:550;}
.ar-poster .ar-panel{border-width:calc(3px * var(--ar-scale));border-color:var(--accent);box-shadow:calc(8px * var(--ar-scale)) calc(8px * var(--ar-scale)) 0 color-mix(in srgb,var(--accent) 30%,transparent);}
.ar-poster .ar-headline{font-weight:900;letter-spacing:-.045em;}
.ar-precision .ar-panel{border-radius:calc(10px * var(--ar-scale));}
`;
export const ADAPTIVE_BOOT = `
if(stage.hasAttribute('data-adaptive')) {
 var enter=Number(stage.getAttribute('data-entrance'));
 var contentTime=Number(stage.getAttribute('data-content-duration'));
 var head=stage.querySelector('.ar-headline');
 tl.fromTo(head,{opacity:0,y:16},{opacity:1,y:0,duration:enter,ease:'power2.out'},0);
 stage.querySelectorAll('.ar-panel').forEach(function(panel){
  var at=Number(panel.getAttribute('data-at')),focus=Number(panel.getAttribute('data-focus'));
  tl.fromTo(panel,{opacity:0,y:20},{opacity:1,y:0,duration:enter,ease:'power3.out'},at);
  var focusLine=panel.querySelector('.ar-focus-line');if(focusLine) tl.fromTo(focusLine,{scaleX:0},{scaleX:1,duration:Math.min(.55,contentTime*.08),ease:'power2.inOut'},focus);
  if(focus>0) tl.fromTo(panel,{scale:1},{scale:1.012,duration:Math.min(.35,contentTime*.04),yoyo:true,repeat:1,ease:'sine.inOut',immediateRender:false},focus);
  var bar=panel.querySelector('.ar-bar');if(bar) tl.fromTo(bar,{scaleX:0},{scaleX:1,duration:enter,ease:'power3.out'},at);
 });
 stage.querySelectorAll('.ar-connections path').forEach(function(path){tl.fromTo(path,{strokeDasharray:'1 1',strokeDashoffset:1},{strokeDashoffset:0,duration:Math.min(.6,contentTime*.08),ease:'power2.inOut'},Number(path.getAttribute('data-focus')));});
 var source=stage.querySelector('.ar-source');if(source) tl.fromTo(source,{opacity:0},{opacity:1,duration:enter},0);
 tl.fromTo(stage.querySelector('.ar-rule'),{scaleX:0},{scaleX:1,duration:Math.min(contentTime*.7,2),ease:'power2.out'},0);
}
`;
