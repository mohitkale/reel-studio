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
  return html.replace(/\n/g, "<br/>");
}

function content(scene: ReelScene): string {
  const role = scene.role ?? "tip";
  const items = (scene.items ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
  const visual = scene.visual
    ? `<div class="cp-visual fx-pop">${escapeHtml(scene.visual)}</div>`
    : "";
  const label = `<div class="cp-label fx-kicker">${escapeHtml(role)}</div>`;
  const copy = emphasizedText(scene);

  if (role === "tip" && items.length) {
    return `${label}<h2 class="cp-title fx-line"><span class="fx-line-inner">${copy}</span></h2><div class="cp-tips">${items.map((item, index) => `<div class="cp-tip fx-check-item"><b>${String(index + 1).padStart(2, "0")}</b><span>${escapeHtml(item)}</span></div>`).join("")}</div>`;
  }
  const cta =
    role === "cta" && items[0]
      ? `<div class="cp-cta fx-cta-btn">${escapeHtml(items[0])}</div>`
      : "";
  return `${label}${visual}<h2 class="cp-hero fx-line"><span class="fx-line-inner">${copy}</span></h2>${cta}`;
}

/** HyperFrames implementation of Creator Punch 1.0.0 scene roles. */
export function buildCreatorPunchScene(args: {
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
  return `<section id="scene-${escapeHtml(scene.id)}"
      class="clip scene preset-scene creator-punch-scene ${args.transitionClass}"
      data-scene-id="${escapeHtml(scene.id)}"
      data-production-preset="creator-punch"
      data-preset-version="1.0.0"
      data-scene-role="${escapeHtml(scene.role)}"
      data-start="${args.absoluteStart.toFixed(3)}"
      data-duration="${args.duration.toFixed(3)}"
      data-track-index="1"
      data-exit-window="${args.exitWindow.toFixed(3)}"
      style="--accent:${tokens.accent};--accent-2:${tokens.accentSecondary};--motion-stiffness:${args.motionStiffness}">
    <div class="fx-stage cp-stage recipe-beat-cuts" data-motion-scene="${escapeHtml(scene.id)}" data-recipe="beat-cuts">
      <div class="cp-glow one"></div><div class="cp-glow two"></div><div class="cp-stripes"></div><div class="fx-grain"></div>
      <div class="cp-content">${content(scene)}</div>
    </div>
  </section>`;
}

export const CREATOR_PUNCH_STYLES = `
  .cp-stage { color: #fffaf7; background: #0b0712; overflow: hidden; }
  .cp-glow { position: absolute; width: 82cqw; height: 82cqw; border-radius: 50%; filter: blur(52px); opacity: .34; }
  .cp-glow.one { left: -36cqw; top: -30cqw; background: var(--accent); }
  .cp-glow.two { right: -38cqw; bottom: -34cqw; background: var(--accent-2); }
  .cp-stripes { position: absolute; inset: 0; opacity: .12; background-image: linear-gradient(115deg, transparent 45%, rgba(255,255,255,.28) 46%, transparent 47%); background-size: 42px 42px; }
  .cp-content { position: absolute; inset: 0; z-index: 7; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: clamp(22px, 3cqw, 42px); padding: var(--safe-top, 10%) var(--safe-right, 8%) var(--safe-bottom, 10%) var(--safe-left, 8%); text-align: center; }
  .cp-label { margin: 0; padding: 9px 16px; border-radius: 999px; color: #0b0712; background: var(--accent); font-weight: 900; }
  .cp-visual { font-size: clamp(64px, 11cqw, 140px); line-height: 1; filter: drop-shadow(8px 10px 0 rgba(0,0,0,.25)); }
  .cp-title, .cp-hero { width: min(100%, var(--content-max-width)); }
  .cp-title .fx-line-inner { color: #fffaf7; font-size: clamp(42px, 6.4cqw, 82px); font-weight: 900; line-height: .98; white-space: normal; }
  .cp-hero .fx-line-inner { color: #fffaf7; font-size: clamp(52px, 8.5cqw, 110px); font-weight: 950; line-height: .94; letter-spacing: -.055em; white-space: normal; }
  .cp-content em { color: var(--accent); font-style: normal; text-shadow: 4px 4px 0 color-mix(in oklab, var(--accent-2) 65%, transparent); }
  .cp-tips { width: min(100%, var(--content-max-width)); display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; text-align: left; }
  .cp-tip { min-height: 94px; display: grid; grid-template-columns: 50px 1fr; align-items: center; gap: 14px; padding: 18px 20px; border: 2px solid rgba(255,255,255,.18); border-radius: 18px; background: rgba(17,10,29,.82); font-size: clamp(23px, 3.2cqw, 38px); font-weight: 800; }
  .cp-tip b { color: var(--accent); }
  .cp-cta { padding: 16px 30px; border-radius: 16px; color: #0b0712; background: var(--accent); box-shadow: 8px 8px 0 var(--accent-2); font-size: clamp(24px, 3.2cqw, 38px); font-weight: 950; }
  @media (max-aspect-ratio: 4/5) { .cp-tips { grid-template-columns: 1fr; } }
`;
