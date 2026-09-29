import type { BrandTokens } from "@/compositions/tokens";
import type { ReelScene } from "@/compositions/types";
import { resolveMotionDirection } from "@/production/motion";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildTypeMotionScene(args: {
  scene: ReelScene;
  tokens: BrandTokens;
  absoluteStart: number;
  duration: number;
  exitWindow: number;
  transitionClass: string;
}): string | null {
  const { scene, tokens } = args;
  const motion = resolveMotionDirection(scene.motion, scene.text);
  if (!motion || scene.hideText) return null;
  const impact = motion.recipeId === "type-impact";
  const role = escapeHtml(scene.role ?? "statement");
  const copy = escapeHtml(scene.text);
  const content = impact
    ? `<div class="tm-impact-shape"></div>
       <div class="tm-impact-content">
         <div class="tm-kicker fx-kicker"><span class="tm-index">${String((scene.order ?? 0) + 1).padStart(2, "0")}</span>${role}</div>
         <h2 class="tm-impact-copy fx-line"><span class="fx-line-inner">${copy}</span></h2>
         <div class="tm-impact-rule"></div>
       </div>`
    : `<div class="tm-paper"></div><div class="tm-editorial-rail"></div>
       <div class="tm-editorial-content">
         <div class="tm-editorial-kicker fx-kicker"><span>${String((scene.order ?? 0) + 1).padStart(2, "0")}</span>${role}</div>
         <h2 class="tm-editorial-copy fx-line"><span class="fx-line-inner">${copy}</span></h2>
         <div class="tm-editorial-footer"><i></i><span>${String((scene.order ?? 0) + 1).padStart(2, "0")}</span></div>
       </div>`;
  return `<section id="scene-${escapeHtml(scene.id)}"
    class="clip scene motion-scene ${args.transitionClass}"
    data-scene-id="${escapeHtml(scene.id)}"
    data-motion-recipe="${motion.recipeId}"
    data-motion-version="${motion.version}"
    data-start="${args.absoluteStart.toFixed(3)}"
    data-duration="${args.duration.toFixed(3)}"
    data-track-index="1"
    data-exit-window="${args.exitWindow.toFixed(3)}"
    style="--accent:${escapeHtml(tokens.accent)};--accent-2:${escapeHtml(tokens.accentSecondary)}">
      <div class="fx-stage tm-stage ${impact ? "tm-impact-stage" : "tm-editorial-stage"}"
        data-motion-scene="${escapeHtml(scene.id)}" data-recipe="${motion.recipeId}">${content}</div>
    </section>`;
}

export const TYPE_MOTION_STYLES = `
  .tm-stage { container-type: inline-size; }
  .tm-impact-stage { color: #fffdf7; background: #0b0c12; }
  .tm-impact-stage::before { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 88% 16%, color-mix(in oklab, var(--accent) 42%, transparent), transparent 48%); }
  .tm-impact-shape { position: absolute; left: -12%; top: 18%; width: 128%; height: 26%; background: var(--accent); transform: rotate(-11deg) scaleX(0); transform-origin: left center; opacity: .88; }
  .tm-impact-content { position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; gap: clamp(22px, 4cqw, 58px); padding: var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left); }
  .tm-kicker { display: flex; align-items: center; gap: 18px; font-size: clamp(16px, 2.2cqw, 26px); font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
  .tm-index { display: inline-flex; min-width: 54px; height: 54px; align-items: center; justify-content: center; color: #0b0c12; background: var(--accent); border-radius: 50%; letter-spacing: 0; }
  .tm-impact-copy { width: min(100%, var(--content-max-width)); }
  .tm-impact-copy .fx-line-inner { color: #fffdf7; font-size: clamp(54px, 8.6cqw, 112px); font-weight: 950; line-height: .98; letter-spacing: -.055em; white-space: normal; overflow-wrap: anywhere; text-transform: uppercase; text-shadow: 6px 7px 0 rgba(0,0,0,.24); }
  .tm-impact-rule { width: min(42%, 360px); height: clamp(8px, 1.4cqw, 16px); background: var(--accent-2); transform: scaleX(0); transform-origin: left center; }
  .tm-editorial-stage { color: #241d19; background: #f2ece2; }
  .tm-paper { position: absolute; inset: 0; background: radial-gradient(circle at 84% 23%, color-mix(in oklab, var(--accent) 24%, transparent), transparent 33%), linear-gradient(115deg, #faf7ef, #e9dfd1); }
  .tm-editorial-rail { position: absolute; left: var(--safe-left); top: var(--safe-top); bottom: var(--safe-bottom); width: 3px; background: var(--accent); transform: scaleY(0); transform-origin: top center; }
  .tm-editorial-content { position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; gap: clamp(32px, 5cqw, 70px); padding: var(--safe-top) var(--safe-right) var(--safe-bottom) calc(var(--safe-left) + 34px); }
  .tm-editorial-kicker { display: flex; gap: 28px; align-items: center; font-size: clamp(16px, 2cqw, 25px); font-weight: 700; letter-spacing: .18em; text-transform: uppercase; }
  .tm-editorial-kicker span { color: var(--accent); font-weight: 900; }
  .tm-editorial-copy { width: min(100%, var(--content-max-width)); }
  .tm-editorial-copy .fx-line-inner { color: inherit; font-family: "DM Sans", system-ui, sans-serif; font-size: clamp(44px, 6.5cqw, 86px); font-weight: 600; line-height: 1.09; letter-spacing: -.04em; white-space: normal; overflow-wrap: anywhere; }
  .tm-editorial-footer { display: flex; align-items: center; gap: 16px; font-size: clamp(14px, 1.7cqw, 22px); font-weight: 700; letter-spacing: .18em; opacity: .58; }
  .tm-editorial-footer i { display: block; width: 48px; height: 2px; background: currentColor; }
  .scene.has-photo .tm-stage { background: rgba(5,8,15,.45); color: #fff; }
  .scene.has-photo .tm-stage::before { opacity: .45; }
  .scene.has-photo .tm-paper { background: rgba(5,8,15,.35); }
  .scene.has-photo .tm-editorial-copy .fx-line-inner { color: #fff; }
`;
