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
    if (safe)
      html = html.replace(
        new RegExp(safe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
        `<em>${safe}</em>`,
      );
  }
  return html;
}

function codePanel(scene: ReelScene): string {
  const role = scene.role ?? "code";
  const lines = (scene.items ?? [])
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(0, 10);
  return `<div class="dd-panel fx-phone"><div class="dd-panel-bar"><i></i><i></i><i></i><span>${role === "terminal" ? "terminal" : role === "diff" ? "change.diff" : "production.ts"}</span></div><div class="dd-lines">${lines
    .map((line, index) => {
      const add = role === "diff" && line.startsWith("+");
      const remove = role === "diff" && line.startsWith("-");
      return `<div class="dd-line fx-check-item${add ? " add" : remove ? " remove" : ""}"><small>${String(index + 1).padStart(2, "0")}</small><code>${escapeHtml(line)}</code></div>`;
    })
    .join("")}</div></div>`;
}

function content(scene: ReelScene): string {
  const role = scene.role ?? "code";
  const label = `<div class="dd-label fx-kicker">&gt; ${escapeHtml(role)}</div>`;
  if (role === "browser" && scene.background?.url)
    return `${label}<div class="dd-browser fx-phone"><div class="dd-panel-bar"><i></i><i></i><i></i></div><img src="${escapeHtml(scene.background.url)}" alt="" /></div><h2 class="dd-support fx-line"><span class="fx-line-inner">${emphasizedText(scene)}</span></h2>`;
  if (
    (role === "code" || role === "diff" || role === "terminal") &&
    scene.items?.length
  )
    return `${label}<h2 class="dd-title fx-line"><span class="fx-line-inner">${emphasizedText(scene)}</span></h2>${codePanel(scene)}`;
  return `${label}<h2 class="dd-hero fx-line"><span class="fx-line-inner">${emphasizedText(scene)}</span></h2>${scene.visual ? `<div class="dd-cta fx-cta-btn">${escapeHtml(scene.visual)}</div>` : ""}`;
}

/** HyperFrames implementation of Developer Demo 1.0.0 scene roles. */
export function buildDeveloperDemoScene(args: {
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
  return `<section id="scene-${escapeHtml(scene.id)}" class="clip scene preset-scene developer-demo-scene ${args.transitionClass}" data-scene-id="${escapeHtml(scene.id)}" data-production-preset="developer-demo" data-preset-version="1.0.0" data-scene-role="${escapeHtml(scene.role)}" data-start="${args.absoluteStart.toFixed(3)}" data-duration="${args.duration.toFixed(3)}" data-track-index="1" data-exit-window="${args.exitWindow.toFixed(3)}" style="--accent:${tokens.accent};--accent-2:${tokens.accentSecondary};--motion-stiffness:${args.motionStiffness}"><div class="fx-stage dd-stage recipe-terminal" data-motion-scene="${escapeHtml(scene.id)}" data-recipe="terminal"><div class="dd-grid"></div><div class="fx-term-scan"></div><div class="fx-grain"></div><div class="dd-content">${content(scene)}</div></div></section>`;
}

export const DEVELOPER_DEMO_STYLES = `
  .dd-stage { color: #eef8ff; background: radial-gradient(70% 55% at 85% 5%, color-mix(in oklab, var(--accent) 22%, transparent), transparent 72%), #050b12; }
  .dd-grid { position: absolute; inset: 0; opacity: .2; background-image: linear-gradient(rgba(125,211,252,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(125,211,252,.12) 1px, transparent 1px); background-size: 44px 44px; }
  .dd-content { position: absolute; inset: 0; z-index: 7; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: clamp(20px, 2.7cqw, 38px); padding: var(--safe-top, 10%) var(--safe-right, 8%) var(--safe-bottom, 10%) var(--safe-left, 8%); }
  .dd-label { margin: 0; color: var(--accent); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .dd-title, .dd-support, .dd-hero { width: min(100%, var(--content-max-width)); }
  .dd-title .fx-line-inner, .dd-support .fx-line-inner { color: #eef8ff; font-size: clamp(34px, 5cqw, 64px); font-weight: 820; white-space: normal; }
  .dd-support .fx-line-inner { font-size: clamp(28px, 4cqw, 50px); }
  .dd-hero .fx-line-inner { color: #eef8ff; font-size: clamp(48px, 7.2cqw, 92px); font-weight: 880; white-space: normal; }
  .dd-content em { color: var(--accent); font-style: normal; }
  .dd-panel, .dd-browser { width: 100%; height: auto; margin: 0; padding: 0; border: 1px solid rgba(125,211,252,.24); border-radius: 18px; overflow: hidden; background: rgba(3,9,18,.92); box-shadow: 0 30px 90px rgba(0,0,0,.38); }
  .dd-panel-bar { height: 42px; display: flex; align-items: center; gap: 8px; padding: 0 16px; border-bottom: 1px solid rgba(125,211,252,.16); color: #7890a1; font: 15px ui-monospace, SFMono-Regular, Menlo, monospace; }
  .dd-panel-bar i { width: 9px; height: 9px; border-radius: 50%; background: #fb7185; } .dd-panel-bar i:nth-child(2) { background: #fbbf24; } .dd-panel-bar i:nth-child(3) { background: #4ade80; } .dd-panel-bar span { margin-left: 8px; }
  .dd-lines { padding: clamp(18px, 3cqw, 30px); }
  .dd-line { display: grid; grid-template-columns: 40px 1fr; gap: 10px; padding: 5px 8px; color: #d8e8f2; font: clamp(17px, 2.5cqw, 28px)/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
  .dd-line small { color: #496071; } .dd-line code { white-space: pre-wrap; overflow-wrap: anywhere; } .dd-line.add { color: #86efac; background: rgba(34,197,94,.1); } .dd-line.remove { color: #fda4af; background: rgba(244,63,94,.1); }
  .dd-browser img { width: 100%; aspect-ratio: 16 / 10; display: block; object-fit: cover; }
  .dd-cta { padding: 15px 24px; border-radius: 10px; color: #07101a; background: var(--accent); font: 850 clamp(22px, 3cqw, 34px) ui-monospace, SFMono-Regular, Menlo, monospace; }
`;
