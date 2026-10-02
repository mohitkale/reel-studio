import type { BrandTokens } from "@/video/tokens";
import type { ReelScene } from "@/video/types";
import {
  isStoryMotionRecipe,
  resolveMotionDirection,
} from "@/production/motion";
import { storyBrandName, storyMotionGeometry } from "@/production/story-motion";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
export function buildStoryMotionScene(args: {
  scene: ReelScene;
  tokens: BrandTokens;
  width: number;
  height: number;
  absoluteStart: number;
  duration: number;
  exitWindow: number;
  transitionClass: string;
}): string | null {
  const { scene, tokens } = args;
  const motion = resolveMotionDirection(
    scene.motion,
    scene.text,
    scene.chart,
    Boolean(scene.visual),
    scene.items,
    scene.background,
  );
  if (!motion || !isStoryMotionRecipe(motion.recipeId) || scene.hideText)
    return null;
  const id = motion.recipeId;
  const g = storyMotionGeometry(
    args.width,
    args.height,
    scene.text,
    scene.items,
  );
  const brand = storyBrandName(tokens.handle);
  let before = "";
  let after = "";
  if (id === "quiet-center")
    before = '<div class="sm-ring" aria-hidden="true"></div>';
  if (id === "quiet-divider")
    before = `<div class="sm-marker">${String((scene.order ?? 0) + 1).padStart(2, "0")}</div><div class="sm-rule" aria-hidden="true"></div>`;
  if (id === "brand-lockup") {
    before = brand ? `<div class="sm-brand">${escapeHtml(brand)}</div>` : "";
    after = '<div class="sm-rule" aria-hidden="true"></div>';
  }
  if (id === "brand-frame") {
    before = '<div class="sm-rule" aria-hidden="true"></div>';
    after = brand ? `<div class="sm-brand">${escapeHtml(brand)}</div>` : "";
  }
  if (id.startsWith("comparison-"))
    after = `<div class="sm-panels">${scene.items?.map((item, index) => `<div class="sm-panel sm-label-${index}"><span class="sm-number">0${index + 1}</span><div class="sm-label">${escapeHtml(item)}</div></div>`).join("")}</div>`;
  return `<section id="scene-${escapeHtml(scene.id)}" class="clip scene motion-scene ${args.transitionClass}" data-scene-id="${escapeHtml(scene.id)}" data-motion-recipe="${id}" data-motion-version="${motion.version}" data-start="${args.absoluteStart.toFixed(3)}" data-duration="${args.duration.toFixed(3)}" data-track-index="1" data-exit-window="${args.exitWindow.toFixed(3)}" style="--accent:${escapeHtml(tokens.accent)};--accent-2:${escapeHtml(tokens.accentSecondary)}">
    <div class="fx-stage sm-stage sm-${id}" data-motion-scene="${escapeHtml(scene.id)}" data-recipe="${id}" style="${Object.entries(
      { ...g, radius: tokens.radius },
    )
      .map(([key, value]) => `--sm-${key}:${value}px`)
      .join(";")}">
      <div class="sm-content">${before}<h2 class="sm-title sm-copy">${escapeHtml(scene.text)}</h2>${after}</div>
    </div></section>`;
}
export const STORY_MOTION_STYLES = `
  .sm-stage { color:#fffdf7; background:#101626; }
  .sm-content { position:absolute; inset:0; display:flex; flex-direction:column; justify-content:center; gap:var(--sm-gap); padding:var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left); }
  .sm-title { margin:0; position:relative; font-size:var(--sm-headline); font-weight:850; line-height:1.1; letter-spacing:-.035em; overflow-wrap:anywhere; }
  .sm-panels { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:var(--sm-gap); }
  .sm-panel { display:flex; flex-direction:column; align-items:flex-start; justify-content:space-between; gap:var(--sm-gap); min-width:0; min-height:var(--sm-panelHeight); padding:var(--sm-padding); box-sizing:border-box; background:#192337; border-top:4px solid var(--accent); border-radius:var(--sm-radius); }
  .sm-panel:nth-child(2) { background:#27344a; border-color:var(--accent-2); }
  .sm-number { font-size:calc(var(--sm-brand) * .65); flex-shrink:0; font-weight:600; }
  .sm-label { font-size:var(--sm-label); line-height:1.16; font-weight:650; overflow-wrap:anywhere; min-width:0; }
  .sm-comparison-stack .sm-panels { grid-template-columns:minmax(0,1fr); }
  .sm-comparison-stack .sm-panel { flex-direction:row; align-items:center; justify-content:flex-start; min-height:var(--sm-rowHeight); }
  .sm-quiet-divider, .sm-quiet-center { color:#241d19; background:#f2ece2; }
  .sm-quiet-divider .sm-title, .sm-quiet-center .sm-title { font-weight:500; }
  .sm-marker { font-size:var(--sm-marker); line-height:1; font-weight:500; color:#73685d; }
  .sm-rule { background:var(--accent); transform-origin:left top; }
  .sm-quiet-divider .sm-rule { width:36%; height:2px; }
  .sm-quiet-center .sm-content, .sm-brand-lockup .sm-content { align-items:center; text-align:center; }
  .sm-ring { position:absolute; width:var(--sm-ring); height:var(--sm-ring); left:50%; top:50%; margin-left:calc(var(--sm-ring) / -2); margin-top:calc(var(--sm-ring) / -2); border-radius:50%; border:2px solid #c9bfb0; }
  .sm-brand { font-size:var(--sm-brand); font-weight:700; overflow-wrap:anywhere; max-width:100%; }
  .sm-brand-lockup .sm-rule { width:28%; height:7px; transform-origin:center; }
  .sm-brand-frame .sm-rule { width:7px; height:calc(var(--sm-marker) * .6); }
  .sm-brand-frame .sm-brand { padding-top:var(--sm-gap); border-top:1px solid #566176; font-weight:600; }
`;
