import { escapeHtml } from "@/lib/html";
import type { BrandTokens } from "@/video/tokens";
import type { ReelScene } from "@/video/types";
import {
  formatMotionValue,
  isDataMotionRecipe,
  motionBarScaleMax,
  motionSpotlightFraction,
  resolveMotionDirection,
} from "@/production/motion";

export function buildDataMotionScene(args: {
  scene: ReelScene;
  tokens: BrandTokens;
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
    Boolean(scene.visual || scene.items?.length),
  );
  if (
    !motion ||
    !isDataMotionRecipe(motion.recipeId) ||
    !scene.chart ||
    scene.hideText
  )
    return null;
  const chart = scene.chart;
  const series = chart.series[0];
  const max = motionBarScaleMax(series);
  const orbitFraction = motionSpotlightFraction(series);
  const source = chart.sourceAttribution
    ? `<div class="dm-source">Source: ${escapeHtml(chart.sourceAttribution)}</div>`
    : "";
  const header = `<div class="dm-eyebrow fx-kicker"><i></i>${escapeHtml(series.label || scene.role || "Data")}</div>`;
  const story = scene.text
    ? `<h2 class="dm-story fx-line"><span class="fx-line-inner">${escapeHtml(scene.text)}</span></h2>`
    : "";
  const content =
    motion.recipeId === "data-spotlight"
      ? `<div class="dm-spotlight">
          <div class="dm-orbit"><svg viewBox="0 0 360 360" aria-hidden="true">${orbitFraction === undefined ? "" : '<circle class="dm-orbit-track" cx="180" cy="180" r="142"/>'}<circle class="dm-orbit-draw" cx="180" cy="180" r="142" data-dash-end="${(893 * (1 - (orbitFraction ?? 1))).toFixed(3)}"/></svg></div>
          <div class="dm-spot-content">${header}
            <div class="dm-value fx-money-num">${escapeHtml(formatMotionValue(series.values[0], series.unit))}</div>
            <div class="dm-value-label">${escapeHtml(chart.labels[0])}</div>
            ${story}${source}
          </div>
        </div>`
      : `<div class="dm-bars-content">${header}${story}
          <div class="dm-bars">${series.values
            .map((value, index) => {
              const pct = max === 0 ? 0 : (value / max) * 100;
              return `<div class="dm-row"><div class="dm-row-label"><span>${escapeHtml(chart.labels[index])}</span><b>${escapeHtml(formatMotionValue(value, series.unit))}</b></div><div class="dm-bar-track"><i class="dm-bar-fill" style="width:${pct.toFixed(3)}%"></i></div></div>`;
            })
            .join("")}</div>${source}
        </div>`;
  return `<section id="scene-${escapeHtml(scene.id)}" class="clip scene motion-scene ${args.transitionClass}"
    data-scene-id="${escapeHtml(scene.id)}" data-motion-recipe="${motion.recipeId}" data-motion-version="${motion.version}"
    data-start="${args.absoluteStart.toFixed(3)}" data-duration="${args.duration.toFixed(3)}"
    data-track-index="1" data-exit-window="${args.exitWindow.toFixed(3)}"
    style="--accent:${escapeHtml(tokens.accent)};--accent-2:${escapeHtml(tokens.accentSecondary)}">
      <div class="fx-stage dm-stage" data-motion-scene="${escapeHtml(scene.id)}" data-recipe="${motion.recipeId}">
        <div class="dm-grid"></div>${content}
      </div>
    </section>`;
}

export const DATA_MOTION_STYLES = `
  .dm-stage { container-type: size; color: #f3f7f7; background: radial-gradient(circle at 84% 18%, #17343e, #07151d 58%, #050d14); }
  .dm-grid { position: absolute; inset: 0; opacity: .16; background-image: linear-gradient(90deg, var(--accent) 1px, transparent 1px), linear-gradient(var(--accent) 1px, transparent 1px); background-size: 80px 80px; mask-image: linear-gradient(to bottom, transparent, #000 70%); }
  .dm-eyebrow { display: flex; align-items: center; gap: 14px; color: var(--accent); font-size: clamp(15px, 2cqw, 25px); font-weight: 800; letter-spacing: .15em; text-transform: uppercase; }
  .dm-eyebrow i { display: block; width: 48px; height: 3px; background: var(--accent); }
  .dm-story { max-width: var(--content-max-width); margin: 0; }
  .dm-story .fx-line-inner { color: #f3f7f7; font-size: clamp(28px, 4.6cqw, 62px); font-weight: 750; line-height: 1.08; white-space: normal; overflow-wrap: anywhere; }
  .dm-source { color: #a8c0c5; font-size: clamp(14px, 1.7cqw, 22px); letter-spacing: .01em; overflow-wrap: anywhere; }
  .dm-spotlight { position: absolute; inset: 0; display: flex; align-items: center; padding: var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left); }
  .dm-spot-content { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: flex-start; gap: clamp(20px, 3cqw, 42px); max-width: 100%; }
  .dm-value { color: #f3f7f7; font-size: clamp(94px, 19cqw, 280px); font-weight: 950; letter-spacing: -.075em; line-height: .85; white-space: nowrap; max-width: 100%; }
  .dm-value-label { color: var(--accent); font-size: clamp(20px, 2.5cqw, 36px); font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  .dm-orbit { position: absolute; width: min(70cqw, 72cqh); height: min(70cqw, 72cqh); right: -5%; top: 12%; opacity: .64; }
  .dm-orbit svg { width: 100%; height: 100%; transform: rotate(-90deg); }
  .dm-orbit circle { fill: none; stroke-width: 3; }
  .dm-orbit-track { stroke: rgba(255,255,255,.12); }
  .dm-orbit-draw { stroke: var(--accent); stroke-dasharray: 893; stroke-dashoffset: 893; stroke-linecap: round; }
  .dm-bars-content { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; gap: clamp(16px, 2.4cqh, 34px); padding: var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left); }
  .dm-bars { display: flex; flex-direction: column; gap: clamp(13px, 2cqh, 28px); width: min(100%, var(--content-max-width)); }
  .dm-row { opacity: 0; transform: translateY(20px); }
  .dm-row-label { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 7px; color: #e9f0f1; font-size: clamp(19px, 2.7cqw, 34px); font-weight: 650; }
  .dm-row-label b { color: #fff; font-weight: 850; white-space: nowrap; }
  .dm-bar-track { width: 100%; height: clamp(12px, 1.6cqh, 22px); background: rgba(255,255,255,.13); border-radius: 100px; overflow: hidden; }
  .dm-bar-fill { display: block; height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-2)); border-radius: inherit; transform: scaleX(0); transform-origin: left center; }
`;
