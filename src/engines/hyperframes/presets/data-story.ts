import type { BrandTokens } from "@/compositions/tokens";
import type { ReelScene } from "@/compositions/types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function emphasizedText(scene: ReelScene): string {
  let html = escapeHtml(scene.text);
  for (const phrase of scene.emphasis) {
    const safe = escapeHtml(phrase.trim());
    if (!safe) continue;
    html = html.replace(
      new RegExp(safe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
      `<em>${safe}</em>`,
    );
  }
  return html;
}

function chartHtml(scene: ReelScene): string {
  const chart = scene.chart;
  if (!chart) return "";
  const series = chart.series[0];
  const values = series.values.slice(0, 8);
  const magnitude = Math.max(1, ...values.map((value) => Math.abs(value)));
  const bars = values
    .map((value, index) => {
      const height = Math.max(
        8,
        Math.round((Math.abs(value) / magnitude) * 88),
      );
      const display = `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}${series.unit ?? ""}`;
      return `<div class="ds-bar"><b>${escapeHtml(display)}</b><i style="--bar-height:${height}%"></i><span>${escapeHtml(chart.labels[index])}</span></div>`;
    })
    .join("");
  return `<div class="ds-bars fx-chart-bars">${bars}</div>${chart.sourceAttribution ? `<p class="ds-source">Source: ${escapeHtml(chart.sourceAttribution)}</p>` : ""}`;
}

function content(scene: ReelScene): string {
  const role = scene.role ?? "takeaway";
  const label = `<div class="ds-label fx-kicker"><i></i>${escapeHtml(role)}</div>`;
  if (role === "metric" && scene.visual) {
    return `${label}<div class="ds-metric fx-money-num">${escapeHtml(scene.visual)}</div><h2 class="ds-copy fx-line"><span class="fx-line-inner">${emphasizedText(scene)}</span></h2>`;
  }
  if ((role === "chart" || role === "comparison") && scene.chart) {
    return `${label}<h2 class="ds-title fx-line"><span class="fx-line-inner">${emphasizedText(scene)}</span></h2>${chartHtml(scene)}`;
  }
  return `${label}<div class="ds-takeaway"><h2 class="ds-hero fx-line"><span class="fx-line-inner">${emphasizedText(scene)}</span></h2></div>`;
}

/** HyperFrames implementation of Data Story 1.0.0 scene roles. */
export function buildDataStoryScene(args: {
  scene: ReelScene;
  tokens: BrandTokens;
  absoluteStart: number;
  duration: number;
  exitWindow: number;
  transitionClass: string;
  motionStiffness: string;
}): string | null {
  const { scene, tokens } = args;
  if (!scene.role) return null;
  return `<section id="scene-${escapeHtml(scene.id)}" class="clip scene preset-scene data-story-scene ${args.transitionClass}" data-scene-id="${escapeHtml(scene.id)}" data-production-preset="data-story" data-preset-version="1.0.0" data-scene-role="${escapeHtml(scene.role)}" data-start="${args.absoluteStart.toFixed(3)}" data-duration="${args.duration.toFixed(3)}" data-track-index="1" data-exit-window="${args.exitWindow.toFixed(3)}" style="--accent:${tokens.accent};--accent-2:${tokens.accentSecondary};--motion-stiffness:${args.motionStiffness}">
    <div class="fx-stage ds-stage recipe-data-wipe" data-motion-scene="${escapeHtml(scene.id)}" data-recipe="data-wipe"><div class="ds-grid"></div><div class="ds-glow"></div><div class="fx-grain soft"></div><div class="ds-content">${content(scene)}</div></div>
  </section>`;
}

export const DATA_STORY_STYLES = `
  .ds-stage { color: #f4fbff; background: linear-gradient(145deg, #07131d, #0a1d28 58%, #102836); }
  .ds-grid { position: absolute; inset: 0; opacity: .22; background-image: linear-gradient(color-mix(in oklab, var(--accent) 18%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklab, var(--accent) 18%, transparent) 1px, transparent 1px); background-size: 56px 56px; }
  .ds-glow { position: absolute; width: 80cqw; height: 80cqw; border-radius: 50%; right: -44cqw; top: -32cqw; background: var(--accent); filter: blur(90px); opacity: .16; }
  .ds-content { position: absolute; inset: 0; z-index: 7; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: clamp(22px, 3cqw, 42px); padding: var(--safe-top, 10%) var(--safe-right, 8%) var(--safe-bottom, 10%) var(--safe-left, 8%); }
  .ds-label { display: flex; align-items: center; gap: 12px; margin: 0; color: var(--accent); }
  .ds-label i { display: block; width: 38px; height: 3px; background: var(--accent); }
  .ds-metric { color: var(--accent); font-size: clamp(90px, 18cqw, 210px); font-weight: 900; line-height: .86; letter-spacing: -.06em; }
  .ds-copy, .ds-title, .ds-hero { width: min(100%, var(--content-max-width)); }
  .ds-copy .fx-line-inner, .ds-title .fx-line-inner { color: #f4fbff; font-size: clamp(34px, 5.2cqw, 68px); font-weight: 780; line-height: 1.05; white-space: normal; }
  .ds-title .fx-line-inner { font-size: clamp(32px, 4.8cqw, 62px); }
  .ds-hero .fx-line-inner { color: #f4fbff; font-size: clamp(48px, 7.5cqw, 96px); font-weight: 860; line-height: 1.02; white-space: normal; }
  .ds-content em { color: var(--accent); font-style: normal; }
  .ds-takeaway { width: 100%; padding-left: clamp(22px, 3cqw, 38px); border-left: 7px solid var(--accent); }
  .ds-bars { width: 100%; height: min(38cqh, 420px); display: flex; align-items: stretch; gap: clamp(10px, 2cqw, 22px); }
  .ds-bar { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 10px; color: #9fb4c1; text-align: center; }
  .ds-bar b { color: #f4fbff; font-size: clamp(18px, 2.4cqw, 28px); white-space: nowrap; }
  .ds-bar i { display: block; width: 100%; height: var(--bar-height); min-height: 10px; border-radius: 12px 12px 4px 4px; background: linear-gradient(180deg, var(--accent), var(--accent-2)); transform: scaleY(.05); transform-origin: bottom; }
  .ds-bar span { width: 100%; overflow: hidden; text-overflow: ellipsis; font-size: clamp(16px, 2cqw, 23px); white-space: nowrap; }
  .ds-source { color: #8299a7; font-size: clamp(15px, 1.8cqw, 20px); margin: 0; }
`;
