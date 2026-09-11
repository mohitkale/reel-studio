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

function content(scene: ReelScene): string {
  const role = scene.role ?? "feature";
  const copy = emphasizedText(scene);
  const items = (scene.items ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
  const label = `<div class="cb-label fx-kicker">${escapeHtml(role)}</div>`;
  if (role === "testimonial")
    return `${label}<div class="cb-quote-mark">“</div><blockquote class="cb-quote fx-line"><span class="fx-line-inner">${copy}</span></blockquote>${scene.visual ? `<p class="cb-credit">— ${escapeHtml(scene.visual)}</p>` : ""}`;
  if (role === "feature" && items.length)
    return `${label}<h2 class="cb-title fx-line"><span class="fx-line-inner">${copy}</span></h2><div class="cb-features">${items.map((item) => `<div class="cb-feature fx-check-item">${escapeHtml(item)}</div>`).join("")}</div>`;
  if (role === "logo")
    return `${label}<div class="cb-mark fx-logo-mark">${escapeHtml(scene.visual?.slice(0, 2) || "RS")}</div><h2 class="cb-logo-copy fx-line"><span class="fx-line-inner">${copy}</span></h2>`;
  return `${label}<h2 class="cb-hero fx-line"><span class="fx-line-inner">${copy}</span></h2>`;
}

/** HyperFrames implementation of Cinematic Brand 1.0.0 scene roles. */
export function buildCinematicBrandScene(args: {
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
  const media = scene.background?.url
    ? `<img class="cb-media" src="${escapeHtml(scene.background.url)}" alt="" />`
    : "";
  return `<section id="scene-${escapeHtml(scene.id)}" class="clip scene preset-scene cinematic-brand-scene ${args.transitionClass}" data-scene-id="${escapeHtml(scene.id)}" data-production-preset="cinematic-brand" data-preset-version="1.0.0" data-scene-role="${escapeHtml(scene.role)}" data-start="${args.absoluteStart.toFixed(3)}" data-duration="${args.duration.toFixed(3)}" data-track-index="1" data-exit-window="${args.exitWindow.toFixed(3)}" style="--accent:${tokens.accent};--accent-2:${tokens.accentSecondary};--motion-stiffness:${args.motionStiffness}"><div class="fx-stage cb-stage recipe-editorial" data-motion-scene="${escapeHtml(scene.id)}" data-recipe="editorial">${media}<div class="cb-scrim"></div><div class="cb-vignette"></div><div class="fx-grain"></div><div class="cb-content role-${escapeHtml(scene.role)}">${content(scene)}</div></div></section>`;
}

export const CINEMATIC_BRAND_STYLES = `
  .cb-stage { color: #fff8ed; background: radial-gradient(80% 60% at 75% 5%, color-mix(in oklab, var(--accent) 22%, transparent), transparent 70%), #080808; overflow: hidden; }
  .cb-media { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transform: scale(1.04); }
  .cb-scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.18), rgba(0,0,0,.46) 48%, rgba(0,0,0,.88)); }
  .cb-vignette { position: absolute; inset: 0; box-shadow: inset 0 0 180px rgba(0,0,0,.68); }
  .cb-content { position: absolute; inset: 0; z-index: 7; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: clamp(22px, 3cqw, 42px); padding: var(--safe-top, 10%) var(--safe-right, 8%) var(--safe-bottom, 10%) var(--safe-left, 8%); }
  .cb-content.role-hero { justify-content: flex-end; padding-bottom: max(var(--safe-bottom, 10%), 13%); }
  .cb-content.role-logo { align-items: center; text-align: center; }
  .cb-label { margin: 0; color: var(--accent); letter-spacing: .22em; }
  .cb-hero, .cb-title, .cb-quote, .cb-logo-copy { width: min(100%, var(--content-max-width)); }
  .cb-hero .fx-line-inner { color: #fff8ed; font: 620 clamp(50px, 8cqw, 104px)/1.02 Georgia, serif; white-space: normal; }
  .cb-title .fx-line-inner { color: #fff8ed; font: 620 clamp(40px, 6cqw, 78px)/1.06 Georgia, serif; white-space: normal; }
  .cb-content em { color: var(--accent); font-style: italic; }
  .cb-features { width: 100%; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  .cb-feature { padding: 24px 20px; border-top: 2px solid var(--accent); background: rgba(7,7,8,.52); font-size: clamp(22px, 3cqw, 34px); line-height: 1.25; }
  .cb-quote-mark { color: var(--accent); font: 140px/.5 Georgia, serif; }
  .cb-quote .fx-line-inner { color: #fff8ed; font: italic clamp(42px, 6.5cqw, 84px)/1.14 Georgia, serif; white-space: normal; }
  .cb-credit { color: #c7bbaa; font-size: clamp(20px, 2.8cqw, 30px); }
  .cb-mark { width: clamp(100px, 15cqw, 160px); aspect-ratio: 1; display: grid; place-items: center; border: 2px solid var(--accent); border-radius: 50%; color: var(--accent); font: 60px Georgia, serif; }
  .cb-logo-copy .fx-line-inner { color: #fff8ed; font: 600 clamp(38px, 5.6cqw, 70px)/1.1 Georgia, serif; white-space: normal; }
  @media (max-aspect-ratio: 4/5) { .cb-features { grid-template-columns: 1fr; } }
`;
