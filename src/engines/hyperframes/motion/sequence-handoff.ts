import { escapeHtml } from "@/lib/html";
import type { ResolvedSequence } from "@/video/sequence-direction";
import type { BrandTokens } from "@/video/tokens";

export function buildSequenceHandoffs(
  plan: ResolvedSequence | undefined,
  tokens: BrandTokens,
  fps: number,
  width: number,
  height: number,
) {
  return (plan?.boundaries ?? [])
    .filter((b) => b.kind === "shared-card")
    .map((b, index) => {
      const from = b.from!,
        to = b.to!,
        subject = plan!.subjects.find((s) => s.id === b.subjectId)!;
      return `<div id="continuity-${index}" class="clip scene continuity-layer" data-start="${b.startFrame / fps}" data-duration="${b.durationFrames / fps}" data-track-index="4" data-boundary="${index}" style="position:absolute;inset:0;z-index:40;pointer-events:none"><div class="fx-stage ar-stage ar-${b.system} ar-${from.flow === "column" ? "route" : "stack"} continuity-card" data-motion-scene="continuity-${index}" data-recipe="continuity-handoff" data-card-handoff="1" data-from-scene="${escapeHtml(b.fromSceneId)}" data-to-scene="${escapeHtml(b.toSceneId)}" data-from-index="${from.index}" data-to-index="${to.index}" data-to-x="${to.x}" data-to-y="${to.y}" data-to-width="${to.width}" data-to-height="${to.height}" data-to-font="${to.fontSize}" style="position:absolute;opacity:0;left:${from.x}px;top:${from.y}px;width:${from.width}px;height:${from.height}px;font-size:${from.fontSize}px;--ar-scale:${Math.min(width, height) / 1080};--accent:${escapeHtml(tokens[subject.colorSlot])}"><div class="ar-panel" style="inset:0;font-size:inherit"><span class="ar-number">${String(from.index + 1).padStart(2, "0")}</span><div class="ar-copy">${escapeHtml(from.label)}</div><i class="ar-focus-line" aria-hidden="true"></i></div></div></div>`;
    })
    .join("");
}

/** Root timeline integration, no callbacks or runtime clones. Geometry is frozen in DOM. */
export const SEQUENCE_HANDOFF_BOOT = `
if(stage.hasAttribute('data-card-handoff')) {
 var duration=Number(stage.parentElement.dataset.duration);
 tl.fromTo(stage,{left:Number.parseFloat(stage.style.left),top:Number.parseFloat(stage.style.top),width:Number.parseFloat(stage.style.width),height:Number.parseFloat(stage.style.height),fontSize:Number.parseFloat(stage.style.fontSize)},
  {left:Number(stage.dataset.toX),top:Number(stage.dataset.toY),width:Number(stage.dataset.toWidth),height:Number(stage.dataset.toHeight),fontSize:Number(stage.dataset.toFont),duration:duration,ease:'power2.inOut',immediateRender:false},0);
 tl.fromTo(stage,{opacity:0},{opacity:1,duration:.03,ease:'none',immediateRender:false},0);
 tl.fromTo(stage,{opacity:1},{opacity:0,duration:.03,ease:'none',immediateRender:false},duration-.03);
}
`;
