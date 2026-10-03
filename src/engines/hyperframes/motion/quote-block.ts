import { EXTENSION_MOTION_RECIPES } from "@/video/motion-extensions";
import { escapeHtml } from "@/lib/html";
import type { MotionBlockArgs } from "./registered-blocks";

export const quoteMarginBlock = {
  recipe: EXTENSION_MOTION_RECIPES[0],
  render: ({
    scene,
    tokens,
    absoluteStart,
    duration,
    exitWindow,
    transitionClass,
  }: MotionBlockArgs) => `
<section id="scene-${escapeHtml(scene.id)}" class="clip scene motion-scene ${transitionClass}"
 data-scene-id="${escapeHtml(scene.id)}" data-motion-recipe="quote-margin" data-motion-version="1.0.0"
 data-start="${absoluteStart.toFixed(3)}" data-duration="${duration.toFixed(3)}" data-track-index="1" data-exit-window="${exitWindow.toFixed(3)}"
 style="--accent:${escapeHtml(tokens.accent)};--accent-2:${escapeHtml(tokens.accentSecondary)}">
 <div class="fx-stage qm-stage${Array.from(scene.text).length > 80 ? " qm-long" : ""}" data-motion-scene="${escapeHtml(scene.id)}" data-recipe="quote-margin">
  <div class="qm-content"><span class="qm-mark fx-qmark" aria-hidden="true">“</span>
  <blockquote class="qm-copy fx-line"><span class="fx-line-inner">${escapeHtml(scene.text)}</span></blockquote>
  <div class="qm-rule fx-rule"></div></div>
 </div>
</section>`,
  styles: `
.qm-stage { background:#101925; color:#f8f6ef; container-type:inline-size; }
.qm-content { position:absolute; inset:0; display:flex; flex-direction:column; justify-content:center; align-items:flex-start; padding:var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left); gap:clamp(16px,3cqw,36px); }
.qm-stage .qm-mark { display:block; color:var(--accent); font-family:"EB Garamond",serif; font-size:clamp(64px,10cqw,120px); line-height:1.3; }
.qm-copy { margin:0; width:min(100%,var(--content-max-width)); }
.qm-copy .fx-line-inner { color:inherit; font-family:"EB Garamond",serif; font-size:clamp(34px,5.6cqw,72px); line-height:1.12; letter-spacing:-.02em; white-space:normal; overflow-wrap:anywhere; padding-bottom:.12em; }
.qm-stage.qm-long .qm-copy .fx-line-inner { font-size:clamp(26px,3.8cqw,48px); }
.qm-rule { width:28%; height:3px; background:var(--accent); transform-origin:left center; }
`,
};
