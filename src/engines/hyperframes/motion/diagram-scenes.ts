import type { BrandTokens } from "@/video/tokens";
import type { ReelScene } from "@/video/types";
import { diagramLabelLines, orbitNodes } from "@/production/diagram-geometry";
import {
  isDiagramMotionRecipe,
  resolveMotionDirection,
} from "@/production/motion";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function labelTspans(label: string, x: number, fontSize: number): string {
  const lines = diagramLabelLines(label);
  return lines
    .map(
      (line, index) =>
        `<tspan x="${x}" dy="${index === 0 ? (lines.length === 1 ? fontSize * 0.36 : -fontSize * 0.2) : fontSize * 1.12}">${escapeHtml(line)}</tspan>`,
    )
    .join("");
}

export function buildDiagramMotionScene(args: {
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
    Boolean(scene.visual),
    scene.items,
  );
  if (
    !motion ||
    !isDiagramMotionRecipe(motion.recipeId) ||
    !scene.items ||
    scene.hideText
  )
    return null;
  const items = scene.items;
  const title = scene.text.trim()
    ? `<h2 class="gm-title fx-line"><span class="fx-line-inner">${escapeHtml(scene.text)}</span></h2>`
    : "";
  const eyebrow = `<div class="gm-eyebrow fx-kicker"><i></i>${motion.recipeId === "diagram-orbit" ? "Connections" : "The path"}</div>`;
  const content =
    motion.recipeId === "diagram-orbit"
      ? `<svg class="gm-orbit" viewBox="0 0 1000 1000" aria-hidden="true">
          <circle cx="500" cy="500" r="375" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="2" stroke-dasharray="6 12"/>
          ${orbitNodes(items.length - 1)
            .map((point, index) => {
              const x = point.x.toFixed(2);
              const y = point.y.toFixed(2);
              const controlX = ((point.x + 500) / 2 + 45).toFixed(2);
              const controlY = ((point.y + 500) / 2 - 45).toFixed(2);
              return `<g class="gm-satellite" data-index="${index}">
                <path class="gm-connector" d="M 500 500 Q ${controlX} ${controlY} ${x} ${y}" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" stroke-dasharray="700" stroke-dashoffset="700"/>
                <circle cx="${x}" cy="${y}" r="112" fill="var(--brand-background)" stroke="var(--accent-2)" stroke-width="3"/>
                <text x="${x}" y="${y}" fill="var(--brand-foreground)" text-anchor="middle" font-size="39" font-weight="750">${labelTspans(items[index + 1], point.x, 39)}</text>
              </g>`;
            })
            .join("")}
          <g class="gm-core"><circle cx="500" cy="500" r="150" fill="var(--brand-background)" stroke="var(--accent)" stroke-width="8"/>
            <text x="500" y="500" fill="var(--brand-foreground)" text-anchor="middle" font-size="47" font-weight="850">${labelTspans(items[0], 500, 47)}</text></g>
        </svg>`
      : `<div class="gm-path"><svg class="gm-spine" aria-hidden="true"><line x1="2" y1="0" x2="2" y2="100%" stroke="var(--accent)" stroke-width="4" opacity=".75"/></svg>
          ${items
            .map(
              (item, index) =>
                `<div class="gm-step" data-index="${index}"><div class="gm-number">${String(index + 1).padStart(2, "0")}</div><div class="gm-card">${escapeHtml(item)}</div></div>`,
            )
            .join("")}</div>`;
  return `<section id="scene-${escapeHtml(scene.id)}" class="clip scene motion-scene ${args.transitionClass}"
    data-scene-id="${escapeHtml(scene.id)}" data-motion-recipe="${motion.recipeId}" data-motion-version="${motion.version}"
    data-start="${args.absoluteStart.toFixed(3)}" data-duration="${args.duration.toFixed(3)}"
    data-track-index="1" data-exit-window="${args.exitWindow.toFixed(3)}"
    style="--accent:${escapeHtml(tokens.accent)};--accent-2:${escapeHtml(tokens.accentSecondary)}">
      <div class="fx-stage gm-stage" data-motion-scene="${escapeHtml(scene.id)}" data-recipe="${motion.recipeId}">
        <div class="gm-content">${eyebrow}${title}${content}</div>
      </div>
    </section>`;
}

export const DIAGRAM_MOTION_STYLES = `
  .gm-stage { container-type: size; color: #f7f3ec; background: radial-gradient(circle at 25% 15%, #283452, #101626 48%, #080d19); }
  .gm-content { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; gap: clamp(18px, 3cqh, 36px); padding: var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left); }
  .gm-eyebrow { display: flex; align-items: center; gap: 15px; color: var(--accent); font-size: clamp(15px, 2cqw, 25px); font-weight: 850; letter-spacing: .17em; text-transform: uppercase; }
  .gm-eyebrow i { display: block; width: 50px; height: 3px; background: var(--accent); }
  .gm-title { max-width: 96%; margin: 0; }
  .gm-title .fx-line-inner { color: #f7f3ec; font-size: clamp(30px, 5.5cqw, 70px); line-height: 1.04; letter-spacing: -.04em; font-weight: 800; white-space: normal; overflow-wrap: anywhere; }
  .gm-path { position: relative; display: flex; flex-direction: column; gap: clamp(10px, 1.4cqh, 18px); width: 100%; max-width: 1100px; }
  .gm-spine { position: absolute; left: 36px; top: 36px; height: calc(100% - 72px); width: 4px; overflow: visible; }
  .gm-step { position: relative; display: flex; align-items: center; gap: 22px; min-height: min(10.5cqh, 118px); padding: 14px 28px 14px 0; opacity: 0; transform: translateX(46px); }
  .gm-number { z-index: 1; display: grid; place-items: center; width: 76px; height: 76px; flex: none; border-radius: 50%; background: var(--accent); color: #07111a; font-size: 26px; font-weight: 900; }
  .gm-card { flex: 1; padding: 20px 26px; border: 1px solid rgba(255,255,255,.2); border-radius: 22px; background: rgba(20,32,52,.88); box-shadow: 0 18px 42px rgba(0,0,0,.2); font-size: clamp(23px, 3.6cqw, 43px); font-weight: 700; }
  .gm-orbit { display: block; width: min(65cqw, 55cqh, 720px); height: min(65cqw, 55cqh, 720px); max-width: 100%; align-self: center; overflow: visible; }
  .gm-core, .gm-satellite { opacity: 0; }
  @media (max-aspect-ratio: 4/5) { .gm-card { font-size: clamp(26px, 4cqw, 43px); } }
`;
