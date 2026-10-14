import { escapeHtml } from "@/lib/html";
import {
  resolveSemanticGraphic,
  semanticGraphicCaptions,
} from "@/production/semantic-direction";
import { showpieceSchedule, subjectLane } from "@/production/showpiece-plan";
import type { ReelProps } from "@/video/types";
import type { SemanticGraphic } from "@/video/semantic-graphic";
import { semanticArt } from "./semantic-blocks";
import { buildCelestialScene } from "./celestial-blocks";
import type { MotionBlockArgs } from "./registered-blocks";

function positions(graphic: SemanticGraphic, portrait: boolean) {
  const count = graphic.nodes.length;
  if (graphic.kind === "concept") return [{ x: 50, y: 48 }];
  if (graphic.kind === "hierarchy") {
    const levels = graphic.nodes.map((node, i) =>
      i ? 1 + (node.parent ? 1 : 0) : 0,
    );
    const rows: number[][] = [];
    for (const level of [...new Set(levels)]) {
      const group = levels.flatMap((value, index) =>
        value === level ? [index] : [],
      );
      for (let i = 0; i < group.length; i += 4)
        rows.push(group.slice(i, i + 4));
    }
    return levels.map((_, index) => {
      const rowIndex = rows.findIndex((row) => row.includes(index));
      const row = rows[rowIndex];
      return {
        x: ((row.indexOf(index) + 1) * 100) / (row.length + 1),
        y: 12 + (rowIndex * 76) / Math.max(1, rows.length - 1),
      };
    });
  }
  if (graphic.kind === "system")
    return graphic.nodes.map((_, i) =>
      i === 0
        ? { x: 50, y: 48 }
        : {
            x:
              50 +
              Math.cos(-Math.PI / 2 + ((i - 1) * Math.PI * 2) / (count - 1)) *
                34,
            y:
              48 +
              Math.sin(-Math.PI / 2 + ((i - 1) * Math.PI * 2) / (count - 1)) *
                34,
          },
    );
  if (graphic.kind === "comparison")
    return graphic.nodes.map((_, i) =>
      portrait
        ? {
            x: i % 2 ? 72 : 28,
            y: count <= 2 ? 48 : 25 + Math.floor(i / 2) * 44,
          }
        : { x: ((i + 1) * 100) / (count + 1), y: i % 2 ? 62 : 35 },
    );
  return graphic.nodes.map((_, i) =>
    portrait
      ? { x: i % 2 ? 65 : 35, y: 12 + (i * 76) / Math.max(1, count - 1) }
      : { x: 12 + (i * 76) / Math.max(1, count - 1), y: i % 2 ? 64 : 36 },
  );
}
export function buildShowpieceScene(
  args: MotionBlockArgs,
  source: string,
  context: Pick<ReelProps, "width" | "height" | "fps" | "spokenWords">,
  contentStartFrame: number,
  contentDuration: number,
): string | null {
  const graphic = resolveSemanticGraphic(args.scene, source);
  if (!graphic?.presentation) return null;
  const { scene, tokens } = args;
  const portrait = (context.height ?? 1920) > (context.width ?? 1080) * 1.2;
  const points = positions(graphic, portrait);
  const schedule = showpieceSchedule(
    graphic,
    contentDuration,
    context.fps ?? 30,
    contentStartFrame,
    context.spokenWords,
  );
  if (["lunar-cycle", "year-cycle", "sky-orbit"].includes(graphic.presentation))
    return buildCelestialScene(args, graphic, contentDuration, schedule);
  const nodes = semanticGraphicCaptions(scene.text, graphic);
  const isDevice = graphic.presentation === "device-evolution";
  const cards = nodes
    .map(
      (node, i) =>
        `<div class="sp-node sp-lane-${subjectLane(node.label)}" data-sp-index="${i}" data-subject="${escapeHtml(node.label)}" data-symbol="${node.symbol}" style="left:${points[i].x}%;top:${points[i].y}%;--sp-at:${schedule.arrivals[i]}"><div class="sp-node-face"><div class="sp-glyph">${node.symbol === "none" ? '<i class="sp-mark" aria-hidden="true"></i>' : semanticArt(node.symbol)}</div><h3 class="sp-label">${escapeHtml(node.label)}</h3>${node.detail ? `<p class="sp-detail">${escapeHtml(node.detail)}</p>` : ""}</div></div>`,
    )
    .join("");
  const edges = points
    .slice(1)
    .map((point, i) => {
      const nodeIndex = i + 1;
      const parent =
        graphic.kind === "hierarchy"
          ? (graphic.nodes[nodeIndex].parent ?? 0)
          : graphic.kind === "system"
            ? 0
            : i;
      const from = points[parent];
      return `<path class="sp-wire" data-target="${nodeIndex}" pathLength="1" d="M${from.x * 10} ${from.y * 6.5} L${point.x * 10} ${point.y * 6.5}"/><${graphic.kind === "flow" ? "g" : "circle"} class="sp-packet" data-target="${nodeIndex}" data-from-x="${from.x * 10}" data-from-y="${from.y * 6.5}" data-to-x="${point.x * 10}" data-to-y="${point.y * 6.5}" r="6">${graphic.kind === "flow" ? '<rect x="-19" y="-14" width="38" height="28" rx="5"/><path d="M-11-5h22M-11 1h18M-11 7h12" fill="none" stroke="var(--brand-background)" stroke-width="2"/>' : ""}</${graphic.kind === "flow" ? "g" : "circle"}>`;
    })
    .join("");
  const screens = nodes
    .map(
      (node, i) =>
        `<div class="sp-screen-state" data-sp-index="${i}" data-subject="${escapeHtml(node.label)}" data-symbol="${node.symbol}" style="--sp-at:${schedule.arrivals[i]}"><div class="sp-screen-art sp-screen-art-${i}" aria-hidden="true"><i></i><i></i><i></i><i></i></div><h3 class="sp-label">${escapeHtml(node.label)}</h3>${node.detail ? `<p class="sp-detail">${escapeHtml(node.detail)}</p>` : ""}</div>`,
    )
    .join("");
  const world = isDevice
    ? `<div class="sp-device"><div class="sp-device-edge"></div><div class="sp-screen">${screens}</div><i class="sp-device-notch" aria-hidden="true"></i></div><div class="sp-snapshots">${nodes.map((node, i) => `<span class="sp-snapshot" data-sp-index="${i}">${escapeHtml(node.label)}</span>`).join("")}</div>`
    : `<svg class="sp-links" viewBox="0 0 1000 650" preserveAspectRatio="none" aria-hidden="true">${["concept", "comparison"].includes(graphic.kind) ? "" : edges}</svg>${cards}`;
  return `<section id="scene-${escapeHtml(scene.id)}" class="clip scene motion-scene ${args.transitionClass}" data-scene-id="${escapeHtml(scene.id)}" data-start="${args.absoluteStart.toFixed(3)}" data-duration="${args.duration.toFixed(3)}" data-track-index="1" data-exit-window="${args.exitWindow.toFixed(3)}" style="--accent:${escapeHtml(tokens.accent)};--accent-2:${escapeHtml(tokens.accentSecondary)}"><div class="fx-stage sp-stage" data-motion-scene="${escapeHtml(scene.id)}" data-recipe="showpiece" data-showpiece="${graphic.presentation}" data-resolve="${schedule.resolve}" data-count="${nodes.length}"><div class="sp-atmosphere" aria-hidden="true"><i class="sp-glow"></i><i class="sp-grid"></i><i class="sp-ring"></i><i class="sp-orbit"></i></div><div class="sp-frame"><header class="sp-header"><span class="sp-eyebrow">${escapeHtml(isDevice ? (scene.text.match(/\b(app|phone|device)\b/i)?.[0] ?? nodes[0].label) : nodes[0].label)}</span><span class="sp-disclosure">Illustrative</span><h2 class="sp-headline">${escapeHtml(scene.text)}</h2></header><div class="sp-window"><div class="sp-camera">${world}</div></div><div class="sp-progress" aria-hidden="true"><i></i></div></div></div></section>`;
}
export const SHOWPIECE_STYLES = `
.sp-stage {container-type:size;color:var(--brand-foreground);background:var(--brand-background);font-family:var(--brand-font);}
.sp-atmosphere {position:absolute;inset:0;overflow:hidden;pointer-events:none;}
.sp-grid {position:absolute;inset:-10%;background-image:radial-gradient(var(--brand-muted) 1px,transparent 1px);background-size:32px 32px;opacity:.18;}
.sp-glow {position:absolute;inset:10% -5% 15%;border-radius:50%;background:radial-gradient(ellipse,var(--accent),transparent 65%);opacity:.2;}
.sp-ring,.sp-orbit {position:absolute;inset:15% 8%;border:2px solid var(--accent);border-radius:50%;opacity:.2;}
.sp-orbit {inset:26% -10%;border-color:var(--accent-2);}
.sp-frame {position:absolute;inset:var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left);display:flex;flex-direction:column;gap:20px;}
.sp-header {display:grid;grid-template-columns:1fr auto;gap:10px;flex:none;}
.sp-eyebrow,.sp-disclosure {font:550 clamp(18px,2.3cqw,28px)/1.2 var(--brand-font);letter-spacing:.08em;text-transform:uppercase;color:var(--brand-muted);}
.sp-headline {grid-column:1/-1;font:780 clamp(32px,5.5cqw,76px)/1.06 var(--brand-font);letter-spacing:-.045em;margin:0;overflow-wrap:anywhere;}
.sp-window {position:relative;flex:1;min-height:0;perspective:1400px;}
.sp-camera {position:absolute;inset:0;transform-style:preserve-3d;}
.sp-node {position:absolute;width:23%;max-width:260px;box-sizing:border-box;transform-style:preserve-3d;}
.sp-node-face {position:relative;background:color-mix(in oklab,var(--brand-background) 93%,var(--accent));border:2px solid var(--node-accent,var(--accent));border-radius:18px;padding:20px 12px;text-align:center;box-shadow:0 18px 50px color-mix(in oklab,var(--brand-foreground) 9%,transparent);}
.sp-lane-0 {--node-accent:var(--accent);} .sp-lane-1 {--node-accent:var(--accent-2);} .sp-lane-2 {--node-accent:var(--brand-muted);}
.sp-glyph {height:clamp(48px,9cqw,110px);color:var(--brand-accent-text);margin:0 auto 12px;}
.sp-glyph .sg-art {width:100%;height:100%;padding:0;max-height:none;}
.sp-label {margin:0;font:700 clamp(22px,3cqw,40px)/1.1 var(--brand-font);overflow-wrap:anywhere;}
.sp-detail {font:450 clamp(22px,2.5cqw,32px)/1.2 var(--brand-font);color:var(--brand-muted);margin:14px 0 0;overflow-wrap:anywhere;}
.sp-mark {display:block;width:36px;height:36px;border:3px solid var(--node-accent);border-radius:50%;margin:auto;}
.sp-links {position:absolute;inset:0;width:100%;height:100%;overflow:visible;stroke:var(--accent);stroke-width:2;fill:none;}
.sp-packet {fill:var(--brand-accent-text);stroke:none;}
.sp-wire {stroke:var(--brand-muted);opacity:.55;}
.sp-progress {flex:none;height:3px;background:color-mix(in oklab,var(--brand-muted) 24%,transparent);}
.sp-progress i {display:block;width:100%;height:100%;background:var(--accent);transform-origin:left;}
.sp-stage[data-showpiece="depth-focus"] .sp-node {width:80%;max-width:none;}
.sp-stage[data-showpiece="depth-focus"] .sp-node-face {display:flex;flex-direction:column;align-items:center;border:0;background:none;padding:0;box-shadow:none;}
.sp-stage[data-showpiece="depth-focus"] .sp-glyph {width:72%;height:27cqh;margin:0 0 24px;}
.sp-stage[data-showpiece="depth-focus"] .sp-label {font-size:clamp(38px,7cqw,90px);color:var(--brand-accent-text);}
.sp-stage[data-showpiece="branch-cascade"] .sp-node {width:19%;}
.sp-stage[data-showpiece="branch-cascade"] .sp-node[data-sp-index="0"] {width:27%;}
.sp-stage[data-showpiece="branch-cascade"] .sp-glyph {height:7cqw;}
.sp-stage[data-showpiece="branch-cascade"] .sp-label {font-size:clamp(22px,2.8cqw,34px);}
.sp-stage[data-count="7"] .sp-node,.sp-stage[data-count="8"] .sp-node {width:19%;}
.sp-stage[data-showpiece="branch-cascade"][data-count="7"] .sp-glyph,.sp-stage[data-showpiece="branch-cascade"][data-count="8"] .sp-glyph {display:none;}
.sp-stage[data-showpiece="branch-cascade"][data-count="7"] .sp-node-face,.sp-stage[data-showpiece="branch-cascade"][data-count="8"] .sp-node-face {padding:8px 6px;}
.sp-stage[data-showpiece="branch-cascade"][data-count="7"] .sp-label,.sp-stage[data-showpiece="branch-cascade"][data-count="8"] .sp-label {font-size:22px;}
.sp-stage[data-showpiece="kinetic-handoff"] .sp-node {width:40%;}
.sp-stage[data-showpiece="kinetic-handoff"] .sp-glyph {height:8cqw;}
.sp-stage[data-showpiece="orbital-comparison"] .sp-node {width:40%;}
.sp-stage[data-showpiece="orbital-comparison"] .sp-node-face {border-radius:28px;}
.sp-device {position:absolute;inset:3% 22% 20%;border-radius:40px;background:var(--brand-foreground);padding:12px;transform-style:preserve-3d;box-shadow:0 28px 60px color-mix(in oklab,var(--brand-foreground) 28%,transparent);}
.sp-device-edge {position:absolute;inset:0;border-radius:inherit;border:3px solid var(--accent);transform:translateZ(-14px);}
.sp-screen {position:relative;width:100%;height:100%;overflow:hidden;border-radius:30px;background:var(--brand-background);}
.sp-device-notch {position:absolute;top:16px;left:38%;right:38%;height:12px;border-radius:10px;background:var(--brand-foreground);}
.sp-screen-state {position:absolute;inset:12% 8% 10%;display:flex;flex-direction:column;justify-content:center;gap:24px;}
.sp-screen-art {display:grid;grid-template-columns:1fr 1fr;gap:12px;height:45%;}
.sp-screen-art i {border:2px solid var(--accent);border-radius:12px;background:color-mix(in oklab,var(--accent) 12%,transparent);}
.sp-screen-art i:first-child {grid-column:1/-1;}
.sp-screen-art-0 i {border-style:dashed;background:none;}
.sp-screen-art-1 i {background:color-mix(in oklab,var(--accent-2) 25%,transparent);}
.sp-screen-art-2 i {background:var(--accent);}
.sp-snapshots {position:absolute;bottom:0;left:0;right:0;display:flex;gap:12px;justify-content:center;}
.sp-snapshot {flex:1;font:650 clamp(22px,2.5cqw,32px)/1.15 var(--brand-font);border-top:3px solid var(--accent);padding-top:12px;overflow-wrap:anywhere;}
 .sp-stage[data-showpiece="branch-cascade"] .sp-ring,.sp-stage[data-showpiece="branch-cascade"] .sp-orbit {display:none;}
 .sp-stage[data-showpiece="branch-cascade"] .sp-grid {background-image:linear-gradient(var(--brand-muted) 1px,transparent 1px),linear-gradient(90deg,var(--brand-muted) 1px,transparent 1px);background-size:48px 48px;opacity:.12;}
 .sp-stage[data-showpiece="kinetic-handoff"] .sp-orbit {display:none;}
 .sp-stage[data-showpiece="kinetic-handoff"] .sp-ring {border-radius:28px;inset:18% 10%;}
 .sp-stage[data-showpiece="device-evolution"] .sp-grid {opacity:.06;}
 .sp-stage[data-showpiece="device-evolution"] .sp-orbit {inset:70% -20% -20%;}
 .sp-stage[data-showpiece="device-evolution"] .sp-ring {inset:18% -10% 10%;}
 .sp-stage[data-showpiece="orbital-comparison"] .sp-grid {opacity:.1;}
@container (min-aspect-ratio:4/5) {
 .sp-stage[data-showpiece="kinetic-handoff"] .sp-node {width:22%;}
 .sp-stage[data-showpiece="orbital-comparison"] .sp-node {width:24%;}
 .sp-node-face {padding:14px 10px;}
 .sp-device {inset:0 35% 20%;}
 .sp-stage[data-showpiece="depth-focus"] .sp-node-face {display:grid;grid-template-columns:1fr 1fr;gap:24px;text-align:left;}
 .sp-stage[data-showpiece="depth-focus"] .sp-glyph {grid-row:1/3;height:29cqh;width:100%;margin:0;}
 .sp-stage[data-showpiece="depth-focus"] .sp-detail {margin:0;}
}
@container (min-aspect-ratio:4/5) and (max-aspect-ratio:5/4) {
 .sp-frame {gap:12px;} .sp-headline {font-size:clamp(28px,5.5cqw,52px);}
 .sp-node-face {padding:10px 6px;} .sp-glyph {height:48px;margin-bottom:8px;}
 .sp-label,.sp-detail {font-size:22px;} .sp-detail {margin-top:8px;}
 .sp-stage[data-showpiece="depth-focus"] .sp-label {font-size:34px;}
 .sp-device {inset:0 23% 24%;} .sp-screen-state {gap:12px;}
}
`;
export const SHOWPIECE_BOOT = `
if (stage.hasAttribute('data-showpiece') && !stage.hasAttribute('data-celestial')) {
 var kind = stage.getAttribute('data-showpiece');
 var camera = stage.querySelector('.sp-camera');
 var done = Number(stage.getAttribute('data-resolve'));
 var head = stage.querySelector('.sp-header');
 tl.fromTo(head,{opacity:0,y:-18},{opacity:1,y:0,duration:.4,ease:'power2.out'},.04);
 tl.fromTo(stage.querySelector('.sp-glow'),{scale:.9,opacity:.12},{scale:1.15,opacity:.25,duration:sceneDuration,ease:'sine.inOut'},0);
 tl.fromTo(stage.querySelector('.sp-grid'),{x:-8,y:-10},{x:8,y:10,duration:sceneDuration,ease:'none'},0);
 tl.fromTo(stage.querySelector('.sp-ring'),{rotation:-8,scale:.9},{rotation:8,scale:1.06,duration:sceneDuration,ease:'sine.inOut'},0);
 tl.fromTo(stage.querySelector('.sp-orbit'),{rotation:12},{rotation:-12,duration:sceneDuration,ease:'sine.inOut'},0);
 var nodes = Array.from(stage.querySelectorAll('.sp-node'));
 nodes.forEach(function(node,i) {
   var at=Number(node.style.getPropertyValue('--sp-at'));
   tl.fromTo(node,{xPercent:-50,yPercent:-50,opacity:0,scale:.7,rotationY:i%2?22:-22,z:-80},{xPercent:-50,yPercent:-50,opacity:1,scale:1,rotationY:0,z:0,duration:.55,ease:'back.out(1.3)'},at);
   var strokes=node.querySelectorAll('svg path,svg rect,svg circle');
   strokes.forEach(function(path,j){tl.fromTo(path,{strokeDasharray:'1 1',strokeDashoffset:1},{strokeDashoffset:0,duration:.5,ease:'power3.inOut'},at+Math.min(.2,j*.02));});
   var detail=node.querySelector('.sp-detail');
   if(detail) tl.fromTo(detail,{opacity:0,y:12},{opacity:1,y:0,duration:.4,ease:'power2.out'},Math.min(done,at+.6));
   tl.fromTo(node.querySelector('.sp-node-face'),{scale:1},{scale:1.035,duration:.4,ease:'sine.inOut',yoyo:true,repeat:1},Math.min(done,at+.65));
 });
 stage.querySelectorAll('.sp-wire').forEach(function(path){var i=Number(path.getAttribute('data-target'));var node=nodes[i];var at=node?Number(node.style.getPropertyValue('--sp-at')):.5;tl.fromTo(path,{strokeDasharray:'1 1',strokeDashoffset:1},{strokeDashoffset:0,duration:.55,ease:'power3.inOut'},at-.12);});
 stage.querySelectorAll('.sp-packet').forEach(function(packet){
   var i=Number(packet.getAttribute('data-target'));var at=nodes[i]?Number(nodes[i].style.getPropertyValue('--sp-at')):.5;
   var fromX=Number(packet.getAttribute('data-from-x')),fromY=Number(packet.getAttribute('data-from-y'));
   var toX=Number(packet.getAttribute('data-to-x')),toY=Number(packet.getAttribute('data-to-y'));
   tl.fromTo(packet,{x:fromX,y:fromY,opacity:0},{x:fromX,y:fromY,opacity:1,duration:.08},at);
   tl.to(packet,{x:toX,y:toY,duration:.55,ease:'power2.inOut'},at+.08);
   tl.to(packet,{opacity:0,duration:.12},at+.64);
   if(kind==='signal-routing') {var again=Math.min(sceneDuration-1,done+.4);if(again>at+.8){tl.fromTo(packet,{x:fromX,y:fromY,opacity:0},{x:fromX,y:fromY,opacity:1,duration:.08},again);tl.to(packet,{x:toX,y:toY,duration:.6,ease:'none'},again+.08);tl.to(packet,{opacity:0,duration:.12},again+.7);}}
 });
 if(kind==='depth-focus') {tl.fromTo(camera,{scale:1.24,rotationY:-9},{scale:1,rotationY:0,duration:Math.min(1.4,sceneDuration*.3),ease:'expo.out'},.1);tl.to(camera,{scale:1.04,duration:Math.max(.1,sceneDuration-1.5),ease:'sine.inOut'},1.5);}
 else {tl.fromTo(camera,{scale:.95,rotationX:kind==='branch-cascade'?8:0},{scale:1,rotationX:0,duration:Math.min(1.2,sceneDuration*.25),ease:'power3.out'},.1);tl.to(camera,{x:kind==='orbital-comparison'?12:0,scale:1.015,duration:Math.max(.1,sceneDuration-1.3),ease:'sine.inOut'},1.3);}
 var device=stage.querySelector('.sp-device');
 if(device){tl.fromTo(device,{opacity:0,y:60,rotationY:-24,rotationX:10},{opacity:1,y:0,rotationY:-5,rotationX:0,duration:.8,ease:'expo.out'},.08);
  var states=Array.from(stage.querySelectorAll('.sp-screen-state'));
  states.forEach(function(screen,i){var at=Number(screen.style.getPropertyValue('--sp-at'));tl.fromTo(screen,{opacity:0,x:i?40:0},{opacity:1,x:0,duration:.45,ease:'power3.out'},at);if(i<states.length-1){var next=Number(states[i+1].style.getPropertyValue('--sp-at'));tl.to(screen,{opacity:0,x:-40,duration:.3,ease:'power2.in'},next-.2);}
   var snap=stage.querySelectorAll('.sp-snapshot')[i];tl.fromTo(snap,{opacity:0,y:16},{opacity:1,y:0,duration:.4,ease:'back.out(1.2)'},at+.3);
  });tl.to(device,{rotationY:5,scale:1.03,duration:Math.max(.1,sceneDuration-.9),ease:'sine.inOut'},.9);
 }
 tl.fromTo(stage.querySelector('.sp-progress i'),{scaleX:0},{scaleX:1,duration:sceneDuration,ease:'none'},0);
}
`;
