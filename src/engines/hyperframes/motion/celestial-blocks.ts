import { escapeHtml } from "@/lib/html";
import type { SemanticGraphic } from "@/video/semantic-graphic";
import type { MotionBlockArgs } from "./registered-blocks";
import type { showpieceSchedule } from "@/production/showpiece-plan";

/** Carry an admitted story's atmosphere through eligible typography beats. */
export function decorateCelestialType(html: string): string {
  const stars = Array.from(
    { length: 32 },
    (_, i) =>
      `<circle cx="${30 + ((i * 137) % 940)}" cy="${30 + ((i * 211) % 940)}" r="${i % 5 ? 1.5 : 3}"/>`,
  ).join("");
  return html.replace(
    /<div\b[^>]*class="fx-stage[^\"]*"[^>]*data-recipe="(?:type-[^\"]+|quiet-[^\"]+|brand-[^\"]+)"[^>]*>/,
    (stage) =>
      `${stage}<svg class="cs-sky" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true"><g>${stars}</g><ellipse cx="650" cy="330" rx="590" ry="190"/><ellipse cx="330" cy="670" rx="510" ry="260"/></svg>`,
  );
}

/** Original qualitative phases; no calendar dates or measured astronomy. */
function moonPhase(index: number): string {
  const phase = index > 4 ? 8 - index : index;
  const edge = Math.max(0.01, Math.abs(Math.cos((phase * Math.PI) / 4)) * 100);
  const lit =
    phase === 0
      ? ""
      : phase === 4
        ? '<circle r="100"/>'
        : `<path d="M0 -100A100 100 0 0 1 0 100A${edge} 100 0 0 ${phase <= 2 ? 0 : 1} 0 -100Z"/>`;
  return `<g${index > 4 ? ' transform="scale(-1 1)"' : ""}><circle r="100" class="cy-dark"/><g class="cy-lit">${lit}</g></g>`;
}
export function buildCelestialScene(
  args: MotionBlockArgs,
  graphic: SemanticGraphic,
  duration: number,
  schedule: ReturnType<typeof showpieceSchedule>,
): string {
  const orbital = graphic.presentation === "sky-orbit";
  const lunar = graphic.presentation === "lunar-cycle",
    { scene, tokens } = args;
  const ticks = Array.from(
    { length: 48 },
    (_, i) =>
      `<path transform="rotate(${i * 7.5})" d="M0 -136v${i % 4 ? 5 : 13}"/>`,
  ).join("");
  const stars = Array.from(
    { length: 22 },
    (_, i) =>
      `<i class="cy-star" style="left:${3 + ((i * 73) % 94)}%;top:${5 + ((i * 41) % 89)}%;--cy-size:${i % 5 ? 2 : 4}px"></i>`,
  ).join("");
  const wheel = `<g class="cy-wheel">${Array.from({ length: 8 }, (_, i) => `<g class="cy-sector" transform="rotate(${i * 45})"><path class="cy-petal" d="M0 -26C-21-45-38-69-25-99L0-120 25-99C38-69 21-45 0-26Z"/><path class="cy-vein" pathLength="1" d="M0-30V-113M0-69l-17-17M0-89l13-13"/></g>`).join("")}<circle r="23" class="cy-heart"/><path class="cy-axis" d="M-7 0H7M0-7V7"/></g>`;
  const constellation =
    '<g class="cy-constellation"><path class="cy-vein" pathLength="1" d="M-87 55L-53-39 13-73 64-18 95 62-87 55M-53-39L64-18 13-73 95 62"/>' +
    [
      [-87, 55],
      [-53, -39],
      [13, -73],
      [64, -18],
      [95, 62],
    ]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" class="cy-heart"/>`)
      .join("") +
    '<ellipse class="cy-orbit" rx="112" ry="45" transform="rotate(-25)"/><circle r="17" class="cy-heart"/></g>';
  const craters = Array.from(
    { length: 9 },
    (_, i) =>
      `<circle cx="${((i * 37) % 130) - 65}" cy="${((i * 53) % 130) - 65}" r="${4 + (i % 4) * 3}"/>`,
  ).join("");
  const phases = Array.from(
    { length: 8 },
    (_, i) =>
      `<g class="cy-phase" data-phase="${i}">${moonPhase(i)}<g class="cy-craters">${craters}</g></g>`,
  ).join("");
  const rail = lunar
    ? `<div class="cy-phase-rail">${Array.from({ length: 8 }, (_, i) => `<svg viewBox="-110 -110 220 220" class="cy-phase-stop" data-phase="${i}" aria-hidden="true">${moonPhase(i)}</svg>`).join("")}</div>`
    : '<div class="cy-rule"><i></i></div>';
  return `<section id="scene-${escapeHtml(scene.id)}" class="clip scene motion-scene ${args.transitionClass}" data-scene-id="${escapeHtml(scene.id)}" data-start="${args.absoluteStart.toFixed(3)}" data-duration="${args.duration.toFixed(3)}" data-track-index="1" data-exit-window="${args.exitWindow.toFixed(3)}" style="--accent:${escapeHtml(tokens.accent)};--accent-2:${escapeHtml(tokens.accentSecondary)}"><div class="fx-stage cy-stage" data-motion-scene="${escapeHtml(scene.id)}" data-showpiece="${graphic.presentation}" data-celestial="${lunar ? "moon" : orbital ? "orbit" : "wheel"}" data-content-duration="${duration}" data-arrive="${schedule.arrivals[0]}" data-resolve="${schedule.resolve}"><div class="cy-sky" aria-hidden="true">${stars}<i class="cy-aura"></i><i class="cy-halo"></i></div><div class="cy-frame"><div class="cy-copy"><span class="cy-eyebrow">${escapeHtml(graphic.nodes[0].label)}</span><h2 class="sp-headline">${escapeHtml(scene.text)}</h2><span class="cy-disclosure">Illustrative cycle</span></div><div class="cy-world"><svg class="cy-orrery" viewBox="-170 -170 340 340" aria-hidden="true"><circle r="150" class="cy-orbit"/><circle r="132" class="cy-orbit"/><g class="cy-ticks">${ticks}</g>${lunar ? phases : orbital ? constellation : wheel}<g class="cy-satellite"><circle cx="0" cy="-150" r="7"/></g></svg>${rail}</div></div></div></section>`;
}
export const CELESTIAL_STYLES = `
.cs-sky{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:.25;z-index:0}.cs-sky circle{fill:var(--brand-foreground)}.cs-sky ellipse{fill:none;stroke:var(--accent);stroke-width:2}
.cy-stage{container-type:size;background:var(--brand-background);color:var(--brand-foreground);font-family:var(--brand-font)}
.cy-sky{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.cy-star{position:absolute;width:var(--cy-size);height:var(--cy-size);background:var(--brand-foreground);border-radius:50%;opacity:.5}
.cy-aura{position:absolute;inset:6% 0;background:radial-gradient(ellipse at 65% 55%,var(--accent-2),transparent 65%);opacity:.2}
.cy-halo{position:absolute;inset:8% -25%;border:2px solid var(--accent);border-radius:50%;opacity:.25}
.cy-frame{position:absolute;inset:var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left);display:grid;grid-template-rows:auto 1fr;gap:32px}
.cy-copy{display:flex;flex-direction:column;justify-content:center;gap:24px;min-width:0}
.cy-eyebrow{font:600 clamp(22px,2.5cqw,32px)/1.2 var(--brand-font);letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
.cy-copy .sp-headline{font-size:clamp(32px,6cqw,88px);line-height:1.08;letter-spacing:-.035em;margin:0;overflow-wrap:anywhere}
.cy-disclosure{font:450 22px/1.2 var(--brand-font);color:var(--brand-muted)}
.cy-world{min-height:0;min-width:0;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:24px}
.cy-orrery{width:100%;max-height:85%;overflow:visible;min-height:0}
.cy-orbit{fill:none;stroke:var(--accent);stroke-width:1;opacity:.65}.cy-ticks{stroke:var(--brand-muted);stroke-width:1.4}
.cy-dark{fill:var(--brand-background);stroke:var(--brand-muted);stroke-width:1}.cy-lit{fill:var(--brand-foreground)}.cy-craters{fill:var(--brand-muted);opacity:.24}
.cy-satellite{fill:var(--accent);filter:drop-shadow(0 0 6px var(--accent))}
.cy-petal{fill:color-mix(in oklab,var(--accent) 30%,var(--brand-background));stroke:var(--accent);stroke-width:1.3}
.cy-sector:nth-child(even) .cy-petal{fill:color-mix(in oklab,var(--accent-2) 34%,var(--brand-background));stroke:var(--accent-2)}
.cy-vein{fill:none;stroke:var(--brand-foreground);stroke-width:1.2;opacity:.7}.cy-heart{fill:var(--accent)}.cy-axis{stroke:var(--brand-background);stroke-width:2}
.cy-phase-rail{display:flex;width:85%;gap:12px;flex:none;padding-top:18px;border-top:2px solid var(--accent)}.cy-phase-stop{flex:1;min-width:0;height:6cqw}
.cy-rule{height:3px;width:80%;background:var(--brand-muted);flex:none}.cy-rule i{display:block;background:var(--accent);height:100%;transform-origin:left}
@container(min-aspect-ratio:4/5){.cy-frame{grid-template-columns:44% 1fr;grid-template-rows:1fr;gap:5cqw}.cy-copy .sp-headline{font-size:clamp(32px,5.2cqw,76px)}.cy-phase-stop{height:4cqw}.cy-copy{gap:20px}}
@container(min-aspect-ratio:4/5) and (max-aspect-ratio:5/4){.cy-frame{grid-template-columns:1fr;grid-template-rows:auto 1fr;gap:16px}.cy-copy{gap:12px}.cy-copy .sp-headline{font-size:clamp(28px,5cqw,44px)}.cy-eyebrow,.cy-disclosure{font-size:22px}.cy-world{gap:12px}}
`;
export const CELESTIAL_BOOT = `
var sky=stage.querySelector('.cs-sky');if(sky)tl.fromTo(sky,{x:-12,y:-8,rotation:-4,scale:1},{x:12,y:8,rotation:4,scale:1.05,duration:sceneDuration,ease:'sine.inOut'},0);
if(stage.hasAttribute('data-celestial')){
 var duration=Number(stage.getAttribute('data-content-duration')), art=stage.querySelector('.cy-orrery');
 tl.fromTo(stage.querySelector('.cy-copy'),{opacity:0,x:-24},{opacity:1,x:0,duration:.55,ease:'power3.out'},.05);
 tl.fromTo(art,{opacity:0,scale:.8,rotation:-12},{opacity:1,scale:1,rotation:0,duration:1,ease:'expo.out'},.12);
 tl.to(art,{scale:1.035,duration:Math.max(.1,duration-1.2),ease:'sine.inOut'},1.2);
 tl.fromTo(stage.querySelector('.cy-aura'),{scale:.9,opacity:.12},{scale:1.1,opacity:.24,duration:duration,ease:'sine.inOut'},0);
 tl.fromTo(stage.querySelector('.cy-halo'),{rotation:-14},{rotation:14,duration:duration,ease:'sine.inOut'},0);
 stage.querySelectorAll('.cy-star').forEach(function(star,i){tl.fromTo(star,{opacity:i%3?.25:.6,y:-4},{opacity:i%3?.6:.25,y:4,duration:duration,ease:'sine.inOut'},0);});
 tl.fromTo(stage.querySelector('.cy-satellite'),{rotation:0,transformOrigin:'0px 0px'},{rotation:150,duration:duration,ease:'none'},0);
 var arrive=Number(stage.getAttribute('data-arrive')),resolve=Number(stage.getAttribute('data-resolve'));var gap=Math.max(.12,(resolve-arrive-.3)/7);
 stage.querySelectorAll('.cy-phase').forEach(function(phase,i){tl.fromTo(phase,{opacity:0},{opacity:1,duration:.18,ease:'sine.inOut'},arrive+i*gap);if(i<7)tl.to(phase,{opacity:0,duration:.18},arrive+(i+1)*gap);});
 stage.querySelectorAll('.cy-phase-stop').forEach(function(stop,i){tl.fromTo(stop,{opacity:.3,y:8},{opacity:1,y:0,duration:.3,ease:'power2.out'},arrive+i*gap);});
 stage.querySelectorAll('.cy-sector').forEach(function(part,i){tl.fromTo(part,{opacity:0},{opacity:1,duration:.35,ease:'sine.out'},arrive+i*gap);});
 stage.querySelectorAll('.cy-vein').forEach(function(path,i){tl.fromTo(path,{strokeDasharray:'1 1',strokeDashoffset:1},{strokeDashoffset:0,duration:.5,ease:'power3.inOut'},arrive+i*gap);});
 var constellation=stage.querySelector('.cy-constellation');if(constellation)tl.fromTo(constellation,{rotation:-8,transformOrigin:'0px 0px'},{rotation:8,duration:duration,ease:'sine.inOut'},0);
 var wheel=stage.querySelector('.cy-wheel');if(wheel)tl.fromTo(wheel,{rotation:-10,transformOrigin:'0px 0px'},{rotation:20,duration:duration,ease:'sine.inOut'},0);
 var rule=stage.querySelector('.cy-rule i');if(rule)tl.fromTo(rule,{scaleX:0},{scaleX:1,duration:duration,ease:'none'},0);
}
`;
