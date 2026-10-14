import { escapeHtml } from "@/lib/html";
import {
  resolveSemanticGraphic,
  semanticGraphicCaptions,
} from "@/production/semantic-direction";
import type { SemanticGraphic } from "@/video/semantic-graphic";
import type { MotionBlockArgs } from "./registered-blocks";

/** Original schematic artwork. Paths convey the named subject; no fabricated UI text or data. */
const ART: Record<SemanticGraphic["nodes"][number]["symbol"], string> = {
  orbit:
    '<ellipse cx="50" cy="50" rx="42" ry="20"/><ellipse cx="50" cy="50" rx="42" ry="20" transform="rotate(60 50 50)"/><circle cx="50" cy="50" r="8"/><circle cx="87" cy="40" r="4"/>',
  moon: '<path d="M69 10A41 41 0 1 0 90 71 36 36 0 0 1 69 10Z"/><circle cx="28" cy="58" r="5"/><circle cx="44" cy="78" r="3"/>',
  cycle:
    '<circle cx="50" cy="50" r="37"/><circle cx="50" cy="50" r="23"/><path d="M50 5v90M5 50h90M18 18l64 64M18 82l64-64"/>',
  agent:
    '<path d="M50 7v10M46 7h8M18 24h64v54H18ZM10 38v25m80-25v25M31 88h38"/><rect x="25" y="32" width="50" height="32" rx="7"/><path d="M35 46h5m20 0h5M40 58h20"/>',
  cloud:
    '<path d="M24 49a18 18 0 0 1-1-36 27 27 0 0 1 50 9 17 17 0 0 1 3 33H25M50 57v14M24 70h52M24 70v12m52-12v12"/><rect x="12" y="83" width="24" height="12" rx="3"/><rect x="64" y="83" width="24" height="12" rx="3"/>',
  device:
    '<rect x="27" y="5" width="46" height="90" rx="8"/><path d="M39 13h22M37 29h26M37 37h18M37 53h26M37 61h26M37 69h16M43 85h14"/>',
  search:
    '<rect x="8" y="12" width="70" height="65" rx="5"/><path d="M8 27h70M18 20h3m5 0h3M19 39h30M19 46h40M19 60h20M19 67h28"/><circle cx="71" cy="69" r="15"/><path d="m82 80 12 12"/>',
  answer:
    '<path d="M10 12h64a8 8 0 0 1 8 8v38a8 8 0 0 1-8 8H35L18 80V66h-8a8 8 0 0 1-8-8V20a8 8 0 0 1 8-8ZM21 29h39M21 40h29"/><path d="M57 77h28l11 12V57a8 8 0 0 0-8-8"/><path d="m51 53 6 6 14-15"/>',
  sources:
    '<path d="M6 9h20v27H6ZM40 9h20v27H40ZM74 9h20v27H74ZM16 42v10h34m34-10v10H50m0-10v18"/><rect x="23" y="64" width="54" height="28" rx="5"/><path d="M33 74h34M33 82h22M12 17h8m-8 8h8m26-8h8m-8 8h8m26-8h8m-8 8h8"/>',
  document:
    '<path d="M20 7h40l20 20v65H20ZM60 7v20h20M31 39h36M31 50h36M31 61h28M31 72h36M31 83h19"/>',
  code: '<rect x="7" y="15" width="86" height="68" rx="5"/><path d="M7 30h86m-74-7h3m5 0h3m5 0h3M34 46 23 57l11 11m32-22 11 11-11 11m-12-27-8 33"/>',
  person:
    '<circle cx="50" cy="25" r="16"/><path d="M21 86V70a29 29 0 0 1 58 0v16M12 51a13 13 0 0 1 0-26m76 26a13 13 0 0 0 0-26M7 85V68a18 18 0 0 1 9-16m77 33V68a18 18 0 0 0-9-16"/>',
  growth:
    '<path d="M50 88V29M50 58C15 64 12 31 12 31s37-7 38 27ZM50 43C50 12 84 9 84 9s9 35-34 34ZM23 89h54"/>',
  target:
    '<circle cx="48" cy="53" r="36"/><circle cx="48" cy="53" r="23"/><circle cx="48" cy="53" r="9"/><path d="m48 53 35-35m-2-11 2 11 11 2"/>',
  shield:
    '<path d="M50 7 84 20v30c0 22-20 37-34 43C36 87 16 72 16 50V20ZM32 50l12 13 26-29"/>',
  clock:
    '<circle cx="50" cy="53" r="35"/><path d="M50 27v26l18 11M38 7h24M50 7v11M78 21l9-9M15 84l7-7"/>',
  idea: '<path d="M35 68c-2-12-17-16-17-35a32 32 0 0 1 64 0c0 19-15 23-17 35ZM35 77h30M38 86h24M43 94h14M41 38l9 10 10-10M50 48v20"/>',
  media:
    '<rect x="7" y="17" width="86" height="65" rx="5"/><path d="m40 34 25 16-25 16ZM7 27h86M18 17v10m16-10v10m16-10v10m16-10v10m16-10v10"/>',
  none: '<circle cx="50" cy="50" r="28"/><path d="M22 50h56M50 22v56"/>',
};
export function semanticArt(
  symbol: SemanticGraphic["nodes"][number]["symbol"],
): string {
  return `<svg class="sg-art" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ART[symbol].replace(/<(path|rect|circle)\b/g, '<$1 pathLength="1"')}</svg>`;
}
export function buildSemanticScene(
  args: MotionBlockArgs,
  storySource?: string,
): string | null {
  const graphic = resolveSemanticGraphic(args.scene, storySource);
  if (!graphic) return null;
  const { scene, tokens } = args;
  const nodes = semanticGraphicCaptions(scene.text, graphic)
    .map(
      (node, index) =>
        `<div class="sg-node" data-subject="${escapeHtml(node.label)}" data-symbol="${node.symbol}">${graphic.relationship ? '<i class="sg-region" aria-hidden="true"></i>' : ""}${semanticArt(node.symbol)}<div class="sg-node-copy"><h3 class="sg-label">${escapeHtml(node.label)}</h3>${node.detail ? `<p class="sg-detail">${escapeHtml(node.detail)}</p>` : ""}</div>${graphic.kind === "flow" && index < graphic.nodes.length - 1 ? '<span class="sg-arrow" aria-hidden="true">→</span>' : ""}</div>`,
    )
    .join("");
  return `<section id="scene-${escapeHtml(scene.id)}" class="clip scene motion-scene ${args.transitionClass}" data-scene-id="${escapeHtml(scene.id)}" data-start="${args.absoluteStart.toFixed(3)}" data-duration="${args.duration.toFixed(3)}" data-track-index="1" data-exit-window="${args.exitWindow.toFixed(3)}" style="--accent:${escapeHtml(tokens.accent)};--accent-2:${escapeHtml(tokens.accentSecondary)}">
  <div class="fx-stage sg-stage" data-motion-scene="${escapeHtml(scene.id)}" data-recipe="semantic-${graphic.kind}" data-semantic-block="${graphic.kind}" data-subject-count="${graphic.nodes.length}"><div class="sg-frame"><h2 class="sg-headline">${escapeHtml(scene.text)}</h2><div class="sg-visual sg-${graphic.relationship ?? graphic.kind}">${nodes}</div><div class="sg-rule" aria-hidden="true"></div></div></div></section>`;
}

export const SEMANTIC_GRAPHIC_STYLES = `
.sg-stage { container-type:size; color:var(--brand-foreground); background:var(--brand-background); font-family:var(--brand-font); }
.sg-frame { position:absolute; inset:var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left); display:flex; flex-direction:column; gap:clamp(24px,4cqw,48px); }
.sg-headline { margin:0; font:750 clamp(32px,6.4cqw,84px)/1.1 var(--brand-font); letter-spacing:-.04em; overflow-wrap:anywhere; }
.sg-visual { flex:1; min-height:0; display:flex; flex-direction:column; justify-content:center; }
.sg-node { position:relative; min-width:0; display:flex; align-items:center; gap:24px; }
.sg-art { flex-shrink:0; color:var(--brand-accent-text); width:28%; max-height:100%; overflow:visible; }
.sg-label { margin:0; font:750 clamp(28px,5.2cqw,64px)/1.1 var(--brand-font); letter-spacing:-.03em; overflow-wrap:anywhere; }
.sg-detail { margin:12px 0 0; color:var(--brand-muted); font:450 clamp(22px,3.8cqw,42px)/1.25 var(--brand-font); overflow-wrap:anywhere; }
.sg-node-copy { min-width:0; }
.sg-concept .sg-node { height:100%; flex-direction:column; align-items:flex-start; justify-content:center; gap:32px; }
.sg-concept .sg-art { width:100%; height:40cqh; max-height:48%; padding:0 12%; box-sizing:border-box; }
.sg-concept .sg-node-copy { width:100%; padding-top:24px; border-top:3px solid var(--accent); }
.sg-concept .sg-label { color:var(--brand-accent-text); font-size:clamp(40px,8cqw,108px); }
.sg-comparison { gap:24px; }
.sg-comparison .sg-node { flex:1; padding:16px 0; border-bottom:2px solid var(--brand-muted); }
.sg-comparison .sg-node:nth-child(even) .sg-art { color:var(--brand-foreground); }
.sg-flow { gap:34px; }
.sg-flow .sg-node { flex:1; padding:8px 0; }
.sg-flow .sg-art { width:23%; }
.sg-arrow { position:absolute; left:10%; bottom:-32px; color:var(--brand-accent-text); font-size:38px; transform:rotate(90deg); line-height:1; }
.sg-rule { height:4px; flex-shrink:0; background:var(--accent); transform-origin:left; }
.sg-overlap { position:relative; flex:0 1 auto; width:min(100%,70cqh); height:min(84cqw,54cqh); align-self:center; margin:auto 0; }
.sg-overlap .sg-node { position:absolute; width:66%; height:auto; aspect-ratio:1; box-sizing:border-box; flex-direction:column; justify-content:flex-start; align-items:flex-start; padding:12% 0 0 8%; gap:8px; }
.sg-overlap .sg-node:nth-child(1) { left:0; top:0; }
.sg-overlap .sg-node:nth-child(2) { right:0; top:0; align-items:flex-end; padding:12% 8% 0 0; }
.sg-overlap .sg-node:nth-child(3) { left:17%; bottom:0; justify-content:flex-end; align-items:center; padding:0 0 8%; }
.sg-region { position:absolute; inset:0; border:3px solid var(--brand-accent-text); border-radius:50%; background:color-mix(in oklab,var(--accent) 8%,transparent); }
.sg-overlap .sg-art { position:relative; z-index:1; width:24%; height:auto; }
.sg-overlap .sg-node-copy { position:relative; z-index:1; }
.sg-overlap .sg-label { font-size:clamp(22px,4cqw,42px); }
.sg-stage[data-subject-count="4"] .sg-comparison { gap:12px; }
.sg-stage[data-subject-count="4"] .sg-label { font-size:clamp(24px,4.6cqw,50px); }
.sg-stage[data-subject-count="4"] .sg-detail { font-size:clamp(22px,3.3cqw,34px); }
@container (min-aspect-ratio:4/5) and (max-aspect-ratio:5/4) {
 .sg-frame { gap:16px; }
 .sg-concept .sg-node { flex-direction:row; gap:5%; }
 .sg-concept .sg-art { width:46%; height:100%; max-height:100%; padding:0; }
 .sg-concept .sg-node-copy { width:49%; }
 .sg-concept .sg-label { font-size:clamp(32px,6.4cqw,56px); }
 .sg-comparison { gap:8px; }
 .sg-comparison .sg-node { padding:6px 0; gap:18px; }
 .sg-comparison .sg-art { width:20%; }
 .sg-comparison .sg-label { font-size:28px; }
 .sg-comparison .sg-detail { font-size:22px; line-height:1.15; margin-top:4px; }
 .sg-stage[data-subject-count="4"] .sg-comparison .sg-art { width:16%; }
 .sg-flow { gap:14px; }
 .sg-flow .sg-node { padding:0; gap:18px; }
 .sg-flow .sg-art { width:18%; }
 .sg-flow .sg-label { font-size:28px; }
 .sg-arrow { bottom:-18px; font-size:24px; }
}
@container (min-aspect-ratio:5/4) {
 .sg-headline { font-size:clamp(32px,4.8cqw,64px); }
 .sg-comparison,.sg-flow { flex-direction:row; gap:32px; align-items:stretch; }
 .sg-comparison .sg-node,.sg-flow .sg-node { flex-direction:column; align-items:flex-start; justify-content:center; border-bottom:0; border-right:2px solid var(--brand-muted); padding-right:24px; }
 .sg-comparison .sg-node:last-child,.sg-flow .sg-node:last-child { border-right:0; padding-right:0; }
 .sg-art,.sg-flow .sg-art { width:100%; height:24cqh; }
 .sg-label { font-size:clamp(28px,4cqw,52px); }
 .sg-detail { font-size:clamp(22px,2.8cqw,34px); }
 .sg-concept .sg-node { flex-direction:row; gap:6%; }
 .sg-concept .sg-art { width:48%; height:100%; max-height:100%; padding:0 4%; }
 .sg-concept .sg-node-copy { width:46%; }
 .sg-concept .sg-label { font-size:clamp(40px,7cqw,96px); }
 .sg-arrow { left:auto; right:-36px; bottom:44%; transform:none; }
}
`;

export const SEMANTIC_GRAPHIC_BOOT = `
if (stage.hasAttribute('data-semantic-block')) {
 var subjects = stage.querySelectorAll('.sg-node');
 var kind = stage.getAttribute('data-semantic-block');
 var head = stage.querySelector('.sg-headline');
 tl.fromTo(head,{opacity:0,y:-18},{opacity:1,y:0,duration:.4,ease:'power2.out'},0);
 subjects.forEach(function(node,i) {
   var at = .08 + i * .12;
   var glyph = node.querySelector('.sg-art');
   var copy = node.querySelector('.sg-node-copy');
   var region = node.querySelector('.sg-region');
   if (region) tl.fromTo(region,{opacity:0,scale:.7},{opacity:1,scale:1,duration:.6,ease:'power3.inOut'},at);
   tl.fromTo(glyph,{opacity:0,scale:.72,x:kind === 'flow' ? -24 : 0},{opacity:1,scale:1,x:0,duration:.5,ease:'power3.out'},at);
   tl.fromTo(copy,{opacity:0,y:16},{opacity:1,y:0,duration:.4,ease:'power2.out'},at+.12);
   glyph.querySelectorAll('path,rect,circle').forEach(function(path,j) {
     tl.fromTo(path,{strokeDasharray:'1 1',strokeDashoffset:1},{strokeDashoffset:0,duration:.55,ease:'power3.inOut'},at+Math.min(j*.025,.12));
   });
   var arrow = node.querySelector('.sg-arrow');
   if (arrow) tl.fromTo(arrow,{opacity:0,scale:.7},{opacity:1,scale:1,duration:.25,ease:'power3.out'},at+.25);
 });
 tl.fromTo(stage.querySelector('.sg-rule'),{scaleX:0},{scaleX:1,duration:.5,ease:'power3.inOut'},.1);
}
`;
