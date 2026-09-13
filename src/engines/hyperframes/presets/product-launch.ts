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
      `<em class="em">${safe}</em>`,
    );
  }
  return html.replace(/\n/g, "<br/>");
}

function mediaHtml(scene: ReelScene): string {
  const media = scene.background;
  if (!media?.url) return "";
  return media.type === "video"
    ? `<video src="${escapeHtml(media.url)}" muted playsinline></video>`
    : `<img src="${escapeHtml(media.url)}" alt="" />`;
}

function roleContent(scene: ReelScene, tokens: BrandTokens): string {
  const role = scene.role ?? "feature";
  const copy = emphasizedText(scene);
  const items = (scene.items ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);

  if (role === "screenshot-demo") {
    return `<div class="pl-role-label fx-kicker">LIVE PRODUCT</div>
      <div class="pl-device fx-phone">
        <div class="pl-browser-bar"><i></i><i></i><i></i></div>
        <div class="pl-media">${mediaHtml(scene)}</div>
      </div>
      <p class="pl-support fx-line"><span class="fx-line-inner">${copy}</span></p>`;
  }

  if (role === "feature" && items.length) {
    return `<div class="pl-role-label fx-kicker">FEATURES</div>
      <h2 class="pl-headline fx-line"><span class="fx-line-inner">${copy}</span></h2>
      <div class="pl-feature-grid">${items
        .map(
          (item, index) =>
            `<div class="pl-feature fx-check-item"><b style="color:${tokens.accent}">${String(index + 1).padStart(2, "0")}</b><span>${escapeHtml(item)}</span></div>`,
        )
        .join("")}</div>`;
  }

  if (role === "comparison" && items.length >= 2) {
    return `<div class="pl-role-label fx-kicker">COMPARE</div>
      <h2 class="pl-headline fx-line"><span class="fx-line-inner">${copy}</span></h2>
      <div class="pl-compare">${items
        .slice(0, 2)
        .map(
          (item, index) =>
            `<div class="pl-compare-card fx-check-item${index === 1 ? " is-accent" : ""}">${escapeHtml(item)}</div>`,
        )
        .join("")}</div>`;
  }

  const cta =
    role === "cta" && scene.visual
      ? `<div class="pl-cta fx-cta-btn">${escapeHtml(scene.visual)}</div>`
      : "";
  return `<div class="pl-role-label fx-kicker">${role === "hook" ? "NEW RELEASE" : escapeHtml(role.toUpperCase())}</div>
    <h2 class="pl-hero-copy fx-line"><span class="fx-line-inner">${copy}</span></h2>
    ${cta}`;
}

/** HyperFrames implementation of Product Launch 1.0.0 scene roles. */
export function buildProductLaunchScene(args: {
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
  const role = scene.role;
  const recipe =
    role === "screenshot-demo"
      ? "terminal"
      : role === "cta"
        ? "minimal-mark"
        : role === "comparison" || role === "feature"
          ? "stack-cards"
          : "billboard";
  const hasMedia = role === "screenshot-demo" && Boolean(scene.background?.url);

  return `<section id="scene-${escapeHtml(scene.id)}"
      class="clip scene preset-scene product-launch-scene ${args.transitionClass}"
      data-scene-id="${escapeHtml(scene.id)}"
      data-production-preset="product-launch"
      data-preset-version="1.0.0"
      data-scene-role="${escapeHtml(role)}"
      data-start="${args.absoluteStart.toFixed(3)}"
      data-duration="${args.duration.toFixed(3)}"
      data-track-index="1"
      data-exit-window="${args.exitWindow.toFixed(3)}"
      style="--accent:${tokens.accent};--accent-2:${tokens.accentSecondary};--foreground:${tokens.foreground};--muted:${tokens.muted};--motion-stiffness:${args.motionStiffness}">
    <div class="fx-stage pl-stage recipe-${recipe}${hasMedia ? " has-media" : ""}" data-motion-scene="${escapeHtml(scene.id)}" data-recipe="${recipe}">
      <div class="pl-mesh"></div>
      <div class="pl-orbit"></div>
      <div class="fx-grain soft"></div>
      <div class="pl-content">${roleContent(scene, tokens)}</div>
    </div>
  </section>`;
}

export const PRODUCT_LAUNCH_STYLES = `
  .pl-stage {
    background:
      radial-gradient(90% 65% at 82% 12%, color-mix(in oklab, var(--accent) 30%, transparent), transparent 60%),
      linear-gradient(155deg, #05070d, #0b1221 58%, color-mix(in oklab, var(--accent-2) 22%, #05070d));
  }
  .pl-mesh {
    position: absolute; inset: 0; opacity: .28;
    background-image:
      linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px);
    background-size: 64px 64px;
    mask-image: radial-gradient(circle at 50% 42%, black, transparent 78%);
  }
  .pl-orbit {
    position: absolute; width: 78cqw; height: 78cqw; border-radius: 50%;
    right: -34cqw; top: -30cqw; border: 1px solid color-mix(in oklab, var(--accent) 42%, transparent);
    box-shadow: 0 0 100px color-mix(in oklab, var(--accent) 18%, transparent);
  }
  .pl-content {
    position: absolute; inset: 0; z-index: 5;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: clamp(24px, 3.2cqw, 52px);
    padding: var(--safe-top, 10%) var(--safe-right, 8%) var(--safe-bottom, 10%) var(--safe-left, 8%);
    color: var(--foreground); text-align: center;
  }
  .pl-role-label {
    color: var(--accent); border: 1px solid color-mix(in oklab, var(--accent) 50%, transparent);
    background: color-mix(in oklab, var(--accent) 12%, transparent);
    border-radius: 999px; padding: 9px 16px; margin: 0;
  }
  .pl-headline, .pl-hero-copy, .pl-support { max-width: var(--content-max-width); }
  .pl-headline .fx-line-inner { font-size: clamp(34px, 5.5cqw, 72px); font-weight: 850; white-space: normal; }
  .pl-hero-copy .fx-line-inner { font-size: clamp(46px, 7.6cqw, 98px); font-weight: 900; white-space: normal; letter-spacing: -.045em; }
  .pl-support .fx-line-inner { font-size: clamp(28px, 4.2cqw, 52px); font-weight: 750; white-space: normal; }
  .pl-device {
    width: min(100%, 980px); aspect-ratio: 16 / 10; padding: 12px; border-radius: 32px;
    background: linear-gradient(145deg, rgba(255,255,255,.22), rgba(255,255,255,.04));
    border: 1px solid rgba(255,255,255,.22); box-shadow: 0 46px 120px rgba(0,0,0,.48);
    overflow: hidden;
  }
  .pl-browser-bar { height: 38px; display: flex; align-items: center; gap: 9px; padding: 0 14px; background: rgba(8,10,18,.96); border-radius: 20px 20px 0 0; }
  .pl-browser-bar i { width: 10px; height: 10px; border-radius: 50%; background: #ff5f57; }
  .pl-browser-bar i:nth-child(2) { background: #febc2e; }
  .pl-browser-bar i:nth-child(3) { background: #28c840; }
  .pl-media { height: calc(100% - 38px); border-radius: 0 0 20px 20px; overflow: hidden; background: rgba(255,255,255,.07); }
  .pl-media img, .pl-media video { width: 100%; height: 100%; display: block; object-fit: cover; }
  .pl-feature-grid, .pl-compare { width: min(100%, var(--content-max-width)); display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
  .pl-feature, .pl-compare-card {
    min-height: 108px; display: flex; align-items: center; gap: 18px;
    padding: 24px; border: 1px solid rgba(255,255,255,.14); border-radius: 24px;
    background: rgba(8,10,18,.72); color: var(--foreground); text-align: left;
    font-size: clamp(24px, 3.2cqw, 40px); font-weight: 720;
  }
  .pl-compare-card { min-height: 150px; justify-content: center; text-align: center; }
  .pl-compare-card.is-accent { border-color: color-mix(in oklab, var(--accent) 58%, transparent); background: color-mix(in oklab, var(--accent) 14%, rgba(8,10,18,.72)); }
  .pl-cta { padding: 16px 32px; border-radius: 999px; background: var(--accent); color: #05070d; font-size: clamp(24px, 3.2cqw, 38px); font-weight: 850; }
  @media (max-aspect-ratio: 4/5) {
    .pl-feature-grid, .pl-compare { grid-template-columns: 1fr; }
    .pl-device { aspect-ratio: 4 / 5; }
  }
`;
