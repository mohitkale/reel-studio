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

function content(scene: ReelScene, tokens: BrandTokens): string {
  const role = scene.role ?? "explanation";
  const copy = emphasizedText(scene);
  const items = (scene.items ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
  const label = `<div class="ed-label fx-kicker"><i style="background:${tokens.accent}"></i>${escapeHtml(role)}</div>`;

  if (role === "diagram" && items.length >= 2) {
    return `${label}<h2 class="ed-title fx-line"><span class="fx-line-inner">${copy}</span></h2>
      <div class="ed-diagram">${items
        .map(
          (item, index) =>
            `<div class="ed-node fx-check-item"><small style="color:${tokens.accent}">${String(index + 1).padStart(2, "0")}</small><span>${escapeHtml(item)}</span></div>`,
        )
        .join("")}</div>`;
  }
  if (role === "quote") {
    return `${label}<div class="ed-quote-mark" style="color:${tokens.accent}">“</div>
      <blockquote class="ed-quote fx-line"><span class="fx-line-inner">${copy}</span></blockquote>
      ${scene.visual ? `<p class="ed-attribution">— ${escapeHtml(scene.visual)}</p>` : ""}`;
  }
  if (role === "summary" && items.length) {
    return `${label}<h2 class="ed-title fx-line"><span class="fx-line-inner">${copy}</span></h2>
      <div class="ed-summary">${items
        .map(
          (item, index) =>
            `<div class="ed-summary-row fx-check-item"><b style="color:${tokens.accent}">${String(index + 1).padStart(2, "0")}</b><span>${escapeHtml(item)}</span></div>`,
        )
        .join("")}</div>`;
  }
  return `${label}<div class="ed-copy${role === "headline" ? " is-headline" : ""} fx-line"><span class="fx-line-inner">${copy}</span></div>`;
}

/** HyperFrames implementation of Editorial Explainer 1.0.0 scene roles. */
export function buildEditorialExplainerScene(args: {
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
      class="clip scene preset-scene editorial-explainer-scene ${args.transitionClass}"
      data-scene-id="${escapeHtml(scene.id)}"
      data-production-preset="editorial-explainer"
      data-preset-version="1.0.0"
      data-scene-role="${escapeHtml(scene.role)}"
      data-start="${args.absoluteStart.toFixed(3)}"
      data-duration="${args.duration.toFixed(3)}"
      data-track-index="1"
      data-exit-window="${args.exitWindow.toFixed(3)}"
      style="--accent:${tokens.accent};--motion-stiffness:${args.motionStiffness}">
    <div class="fx-stage ed-stage recipe-editorial" data-motion-scene="${escapeHtml(scene.id)}" data-recipe="editorial">
      <div class="fx-paper"></div><div class="fx-paper-rule"></div><div class="fx-paper-corner"></div><div class="fx-grain soft"></div>
      <div class="ed-content">${content(scene, tokens)}</div>
    </div>
  </section>`;
}

export const EDITORIAL_EXPLAINER_STYLES = `
  .ed-stage { color: #201d18; }
  .ed-content {
    position: absolute; inset: 0; z-index: 7; display: flex; flex-direction: column;
    align-items: flex-start; justify-content: center; text-align: left;
    gap: clamp(22px, 3cqw, 42px);
    padding: var(--safe-top, 10%) var(--safe-right, 8%) var(--safe-bottom, 10%) var(--safe-left, 8%);
  }
  .ed-label { display: flex; align-items: center; gap: 12px; margin: 0; color: #6d6559; }
  .ed-label i { width: 42px; height: 2px; display: block; }
  .ed-copy, .ed-title, .ed-quote { width: min(100%, var(--content-max-width)); }
  .ed-copy .fx-line-inner { color: #201d18; font-size: clamp(40px, 6.2cqw, 82px); font-weight: 670; white-space: normal; line-height: 1.15; }
  .ed-copy.is-headline .fx-line-inner { font-size: clamp(50px, 7.8cqw, 104px); font-weight: 820; letter-spacing: -.045em; }
  .ed-title .fx-line-inner { color: #201d18; font-size: clamp(34px, 5.2cqw, 68px); font-weight: 760; white-space: normal; }
  .ed-content em { color: #8f351e; font-style: normal; text-decoration: underline; text-decoration-color: rgba(143,53,30,.35); text-underline-offset: .12em; }
  .ed-diagram { width: 100%; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .ed-node { min-height: 110px; padding: 22px; border: 1px solid rgba(32,29,24,.18); border-radius: 8px; background: rgba(255,253,248,.64); display: flex; flex-direction: column; gap: 8px; font-size: clamp(24px, 3.2cqw, 40px); font-weight: 650; }
  .ed-node small { font-size: 14px; letter-spacing: .12em; }
  .ed-quote-mark { font: 150px/.55 Georgia, serif; }
  .ed-quote .fx-line-inner { color: #201d18; font: italic clamp(40px, 6.2cqw, 78px)/1.14 Georgia, serif; white-space: normal; }
  .ed-attribution { color: #6d6559; font-size: clamp(20px, 2.8cqw, 32px); }
  .ed-summary { width: 100%; border-top: 1px solid rgba(32,29,24,.2); }
  .ed-summary-row { display: grid; grid-template-columns: 54px 1fr; gap: 14px; padding: 18px 0; border-bottom: 1px solid rgba(32,29,24,.15); font-size: clamp(24px, 3.2cqw, 38px); }
  @media (min-aspect-ratio: 5/4) { .ed-diagram { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
`;
