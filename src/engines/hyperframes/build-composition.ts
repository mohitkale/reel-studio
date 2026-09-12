/**
 * Build a HyperFrames HTML composition from ReelProps.
 * Deterministic, seekable CSS + GSAP motion — no Remotion imports.
 */

import type { BrandTokens } from "@/compositions/tokens";
import type {
  ReelBeat,
  ReelProps,
  ReelScene,
  SceneMood,
} from "@/compositions/types";
import { coverFrames } from "@/compositions/types";
import {
  DEFAULT_ENERGY_ID,
  DEFAULT_STYLE_ID,
  getMotionRecipe,
  getStyleChrome,
  getTransitionFrames,
  normalizeEnergyId,
  normalizeStyleId,
} from "@/compositions/visual-style";
import { normalizeHfTemplateId } from "@/engines/hyperframes/templates";
import { getCatalogBlockByTemplateId } from "@/engines/hyperframes/catalog/manifest";
import { buildCatalogSceneBlock } from "@/engines/hyperframes/catalog/build-scene";
import {
  NATIVE_CATALOG_STYLES,
  buildGsapMotionBootScript,
  buildCinematicClassicVisual,
} from "@/engines/hyperframes/catalog/native-visuals";
import { resolveProductionLayout } from "@/production/layout";
import {
  buildHyperframesPresetScene,
  HYPERFRAMES_PRESET_STYLES,
} from "@/engines/hyperframes/presets/registry";
import { buildAudioMixPlan, type AudioMixPlan } from "@/lib/audio-mix";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function emphasize(text: string, emphasis: string[]): string {
  let html = escapeHtml(text);
  for (const phrase of emphasis) {
    const safe = escapeHtml(phrase.trim());
    if (!safe) continue;
    html = html.replace(
      new RegExp(safe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
      `<span class="em">${safe}</span>`,
    );
  }
  return html.replace(/\n/g, "<br/>");
}

function moodGradient(mood?: SceneMood): string {
  switch (mood) {
    case "energetic":
      return "linear-gradient(160deg,#1a0b2e 0%,#4a1c6b 45%,#ff4d6d 100%)";
    case "calm":
      return "linear-gradient(160deg,#0b1c24 0%,#1b4332 50%,#95d5b2 100%)";
    case "dramatic":
      return "linear-gradient(160deg,#0d0d0d 0%,#3d0000 55%,#8b0000 100%)";
    case "playful":
      return "linear-gradient(160deg,#1b1030 0%,#5b2c6f 40%,#f4a261 100%)";
    case "inspiring":
      return "linear-gradient(160deg,#0f2027 0%,#203a43 40%,#f6c177 100%)";
    case "tech":
      return "linear-gradient(160deg,#050816 0%,#0b132b 50%,#1c7ed6 100%)";
    case "nature":
      return "linear-gradient(160deg,#081c15 0%,#1b4332 45%,#74c69d 100%)";
    default:
      return "linear-gradient(160deg,#0b0f19 0%,#1a1a2e 50%,#16213e 100%)";
  }
}

function listItems(scene: ReelScene): string[] {
  if (scene.items?.length) return scene.items;
  return scene.text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function sceneInnerHtml(scene: ReelScene, tokens: BrandTokens): string {
  const templateId = normalizeHfTemplateId(scene.templateId);
  const textHtml = emphasize(scene.text, scene.emphasis);
  const visual = scene.visual ? escapeHtml(scene.visual) : "";
  const accent = tokens.accent ?? "#ff6b4a";
  const fg = tokens.foreground ?? "#f8fafc";
  const speaker =
    visual && /^(interviewer|candidate|host|guest)$/i.test(visual.trim())
      ? visual.trim().toUpperCase()
      : "";

  if (scene.hideText) {
    return `<div class="scene-blank"></div>`;
  }

  const speakerChip = speaker
    ? `<p class="speaker-chip" style="color:${fg};border-color:${accent}">${escapeHtml(speaker)}</p>`
    : "";

  switch (templateId) {
    case "hf-opener":
      return `
        <div class="tpl tpl-opener">
          ${speakerChip}
          <div class="accent-bar" style="background:${accent}"></div>
          <p class="opener-text" style="color:${fg}">${textHtml}</p>
        </div>`;
    case "hf-statement":
      return `
        <div class="tpl tpl-statement">
          ${speakerChip}
          <p class="statement-text" style="color:${fg}">${textHtml}</p>
          <div class="underline" style="background:${accent}"></div>
        </div>`;
    case "hf-list": {
      const items = listItems(scene);
      const marker = visual && !speaker ? visual : "→";
      return `
        <div class="tpl tpl-list">
          ${speakerChip}
          <ul>
            ${items
              .map(
                (item, i) => `
              <li class="list-item" style="--i:${i};color:${fg}">
                <span class="marker" style="color:${accent}">${escapeHtml(marker)}</span>
                <span>${escapeHtml(item)}</span>
              </li>`,
              )
              .join("")}
          </ul>
        </div>`;
    }
    case "hf-stat":
      return `
        <div class="tpl tpl-stat">
          ${speakerChip}
          <div class="stat-num" style="color:${accent}">${visual || "—"}</div>
          <p class="stat-text" style="color:${fg}">${textHtml}</p>
        </div>`;
    case "hf-quote":
      return `
        <div class="tpl tpl-quote">
          ${speakerChip}
          <div class="qmark" style="color:${accent}">“</div>
          <p class="quote-text" style="color:${fg}">${textHtml}</p>
          ${
            visual && !speaker
              ? `<p class="quote-attr" style="color:${fg}">— ${visual}</p>`
              : ""
          }
        </div>`;
    case "hf-cta":
      return `
        <div class="tpl tpl-cta">
          ${speakerChip}
          <p class="cta-text" style="color:${fg}">${textHtml}</p>
          <div class="cta-pill" style="background:${accent};color:#0b0f19">
            ${visual || "Follow"}
          </div>
          ${
            tokens.handle
              ? `<p class="cta-handle" style="color:${fg}">@${escapeHtml(tokens.handle.replace(/^@/, ""))}</p>`
              : ""
          }
        </div>`;
    default:
      return `
        <div class="tpl tpl-statement">
          ${speakerChip}
          <p class="statement-text" style="color:${fg}">${textHtml}</p>
        </div>`;
  }
}

function backgroundLayer(
  scene: ReelScene,
  absoluteStart: number,
  durationSec: number,
): string {
  if (scene.background?.type === "image" && scene.background.url) {
    const effect = scene.background.effect ?? "ken-burns";
    const dur = Math.max(0.05, durationSec);
    // Seekable CSS animations: HyperFrames' CSS adapter drives these via
    // animation-delay during capture; the preview seek script does the same.
    return `<div class="bg-photo bg-fx-${escapeHtml(effect)}"
                 data-start="${absoluteStart.toFixed(3)}"
                 data-duration="${dur.toFixed(3)}"
                 data-effect="${escapeHtml(effect)}"
                 style="background-image:url('${escapeHtml(scene.background.url)}');animation-duration:${dur.toFixed(3)}s"></div>
            <div class="bg-scrim"></div>`;
  }
  if (scene.background?.type === "video" && scene.background.url) {
    return `<video class="bg-video" src="${escapeHtml(scene.background.url)}" muted playsinline loop></video>
            <div class="bg-scrim"></div>`;
  }
  return `<div class="bg-mood" style="background:${moodGradient(scene.mood)}"></div>`;
}

function framesToSeconds(frames: number, fps: number): number {
  if (frames <= 0) return 0;
  return Math.max(0.05, frames / Math.max(1, fps));
}

const STYLES = `
  @font-face { font-family: "DM Sans"; src: local("Arial"); }
  @font-face { font-family: "Anton"; src: local("Impact"); }
  @font-face { font-family: "Instrument Serif"; src: local("Georgia"); }
  @font-face { font-family: "Impact"; src: local("Impact"); }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 100%; height: 100%; overflow: hidden;
    background: #05070d; font-family: "DM Sans", system-ui, sans-serif;
    display: flex; align-items: center; justify-content: center;
  }
  /* fit-wrap owns the scaled layout box; #root keeps authored px and is
     visually scaled inside so portrait previews/fullscreen letterbox cleanly. */
  #fit-wrap {
    position: relative;
    flex-shrink: 0;
    overflow: hidden;
  }
  #root {
    position: absolute;
    left: 0;
    top: 0;
    overflow: hidden;
    container-type: size;
    transform-origin: top left;
  }
  /*
   * HyperFrames toggles inline visibility on [data-start] clips during capture.
   * Keep opacity at 1 so scenes aren't stuck invisible when only HF visibility
   * flips (our .is-active class is mainly for the in-editor iframe preview).
   */
  .scene {
    position: absolute; inset: 0; display: flex; align-items: stretch;
    justify-content: stretch; opacity: 1;
  }
  .bg-mood, .bg-photo, .bg-video, .bg-scrim {
    position: absolute; inset: 0;
  }
  .bg-photo {
    background-size: cover; background-position: center;
    will-change: transform;
    animation-timing-function: linear;
    animation-fill-mode: both;
    animation-play-state: paused;
  }
  @keyframes hf-ken-burns {
    from { transform: scale(1); }
    to { transform: scale(1.08); }
  }
  @keyframes hf-pan-left {
    from { transform: scale(1.14) translateX(4%); }
    to { transform: scale(1.14) translateX(-4%); }
  }
  @keyframes hf-pan-right {
    from { transform: scale(1.14) translateX(-4%); }
    to { transform: scale(1.14) translateX(4%); }
  }
  @keyframes hf-pan-up {
    from { transform: scale(1.14) translateY(4%); }
    to { transform: scale(1.14) translateY(-4%); }
  }
  @keyframes hf-pan-down {
    from { transform: scale(1.14) translateY(-4%); }
    to { transform: scale(1.14) translateY(4%); }
  }
  .bg-fx-ken-burns { animation-name: hf-ken-burns; }
  .bg-fx-pan-left { animation-name: hf-pan-left; }
  .bg-fx-pan-right { animation-name: hf-pan-right; }
  .bg-fx-pan-up { animation-name: hf-pan-up; }
  .bg-fx-pan-down { animation-name: hf-pan-down; }
  .bg-video { width: 100%; height: 100%; object-fit: cover; }
  .bg-scrim {
    background: linear-gradient(180deg, rgba(5,7,13,.42) 0%, rgba(5,7,13,.55) 45%, rgba(5,7,13,.88) 100%);
  }
  /* Stock photo under native stages: let imagery breathe through the mesh. */
  .scene.has-photo .bg-scrim {
    background: linear-gradient(180deg, rgba(5,7,13,.55) 0%, rgba(5,7,13,.62) 40%, rgba(5,7,13,.92) 100%);
    z-index: 1;
  }
  .scene.has-photo .fx-stage {
    background: transparent !important;
  }
  .scene.has-photo .fx-void,
  .scene.has-photo .fx-term-bg,
  .scene.has-photo .fx-block-a,
  .scene.has-photo .fx-deep,
  .scene.has-photo .fx-studio,
  .scene.has-photo .fx-bill-bg,
  .scene.has-photo .fx-min-bg {
    opacity: 0.42;
  }
  .scene.has-photo .recipe-editorial .fx-paper {
    opacity: 0.78;
  }
  .content {
    position: relative; z-index: 2; flex: 1;
    display: flex; align-items: center; justify-content: center;
    padding: var(--safe-top, 10%) var(--safe-right, 8%) var(--safe-bottom, 10%) var(--safe-left, 8%);
  }
  .em { color: inherit; box-shadow: inset 0 -0.22em 0 0 var(--accent, #ff6b4a); }
  .speaker-chip {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 18px; font-weight: 800; letter-spacing: 0.18em;
    text-transform: uppercase; opacity: 0.8;
    border: 1px solid; border-radius: 999px;
    padding: 8px 14px; margin-bottom: 22px;
  }
  .tpl { width: 100%; max-width: min(92%, var(--content-max-width, 92%)); }
  .tpl-opener .accent-bar {
    width: 72px; height: 8px; border-radius: 999px; margin-bottom: 28px;
    transform: scaleX(0); transform-origin: left;
  }
  /* cqw = % of the authored stage, so scaled previews keep correct type size */
  .opener-text, .statement-text, .quote-text, .cta-text, .stat-text {
    font-weight: 800; letter-spacing: -0.03em; line-height: 1.12;
    font-size: clamp(42px, 6.2cqw, 78px);
  }
  .statement-text { text-align: center; }
  .underline {
    width: 120px; height: 6px; border-radius: 999px; margin: 28px auto 0;
    transform: scaleX(0); transform-origin: center;
  }
  .tpl-list ul { list-style: none; display: grid; gap: 22px; }
  .list-item {
    display: flex; gap: 16px; align-items: flex-start;
    font-size: clamp(30px, 4.2cqw, 48px); font-weight: 700; line-height: 1.2;
    opacity: 0; transform: translateY(24px);
  }
  .marker { font-size: 0.9em; line-height: 1.2; }
  .stat-num {
    font-size: clamp(96px, 16cqw, 180px); font-weight: 800; line-height: 0.95;
    letter-spacing: -0.05em; text-align: center; margin-bottom: 20px;
    transform: scale(0.7); opacity: 0;
  }
  .stat-text { text-align: center; font-size: clamp(28px, 3.8cqw, 44px); font-weight: 700; }
  .tpl-quote { text-align: left; }
  .qmark {
    font-family: "Instrument Serif", Georgia, serif;
    font-size: clamp(90px, 14cqw, 160px); line-height: 0.7; margin-bottom: 8px;
    opacity: 0.9;
  }
  .quote-text {
    font-family: "Instrument Serif", Georgia, serif; font-style: italic;
    font-weight: 400; font-size: clamp(40px, 5.5cqw, 68px);
  }
  .quote-attr {
    margin-top: 28px; font-size: 28px; font-weight: 600; opacity: 0.75;
  }
  .tpl-cta { text-align: center; }
  .cta-pill {
    display: inline-block; margin-top: 32px; padding: 16px 34px;
    border-radius: 999px; font-size: 28px; font-weight: 800;
    transform: translateY(16px); opacity: 0;
  }
  .cta-handle { margin-top: 22px; font-size: 24px; opacity: 0.7; font-weight: 600; }
  .progress {
    position: absolute; top: 0; left: 0; height: 6px; width: 0%;
    background: var(--accent, #ff6b4a); z-index: 5;
  }
  .cover {
    position: absolute; inset: 0; z-index: 6; background: #05070d center/cover no-repeat;
    opacity: 0; visibility: hidden;
  }
  .cover.is-active { opacity: 1; visibility: visible; }
  /* Catalog sub-compositions — portrait-native production visuals */
  .catalog-scene .catalog-host {
    position: absolute; inset: 0; z-index: 3;
    overflow: hidden; pointer-events: none;
  }
  ${NATIVE_CATALOG_STYLES}
  /* Style + Energy driven via CSS variables on #root */
  .scene {
    --enter-ease: cubic-bezier(0.22, 1, 0.36, 1);
  }
  .scene.style-crossfade .content {
    opacity: calc(0.25 + var(--p, 0) * 0.75);
  }
  .scene.style-blur-slide .content {
    opacity: calc(0.25 + var(--p, 0) * 0.75);
    transform: translateY(calc((1 - var(--p, 0)) * 28px + var(--exit, 0) * -20px));
    filter: blur(calc((1 - var(--p, 0)) * 6px + var(--exit, 0) * 4px));
  }
  .scene.style-accent-flash .content {
    opacity: calc(0.3 + var(--p, 0) * 0.7);
    transform: scale(calc(0.97 + var(--p, 0) * 0.03));
  }
  .scene.style-accent-flash::after {
    content: "";
    position: absolute; inset: 0; z-index: 8; pointer-events: none;
    background: var(--accent, #ff5a5f);
    opacity: calc((1 - var(--p, 0)) * 0.12);
  }
  .tpl-opener .accent-bar,
  .underline {
    transition: none;
  }
  .scene.is-active .tpl-opener .accent-bar,
  .scene.is-active .underline {
    transform: scaleX(calc(min(1, var(--p, 0) * var(--motion-stiffness, 1.2))));
  }
  .list-item {
    opacity: calc(min(1, max(0, (var(--p, 0) - var(--i) * 0.08) * var(--motion-stiffness, 1.4))));
    transform: translateY(calc((1 - min(1, max(0, (var(--p, 0) - var(--i) * 0.08) * 2))) * 24px));
  }
  .stat-num, .cta-pill {
    opacity: calc(min(1, var(--p, 0) * var(--motion-stiffness, 1.5)));
    transform: scale(calc(0.75 + min(1, var(--p, 0) * var(--motion-stiffness, 1.5)) * 0.25));
  }
  #root[data-hide-progress="1"] .progress { display: none; }
  #root[data-grain="1"]::before {
    content: "";
    position: absolute; inset: 0; z-index: 7; pointer-events: none;
    opacity: var(--grain-opacity, 0.08);
    mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }
`;

function buildSeekScript(
  beats: Array<{ id: string; start: number; duration: number }>,
  coverSeconds: number,
  totalSeconds: number,
  fps: number,
  hideProgressBar: boolean,
  audioMix: AudioMixPlan,
): string {
  const payload = JSON.stringify({
    beats,
    coverSeconds,
    totalSeconds,
    fps,
    hideProgressBar,
    audioMix,
  });
  return `
<script>
(function () {
  const CFG = ${payload};
  const root = document.getElementById('root');
  const scenes = Array.from(document.querySelectorAll('.scene'));
  const subtitles = Array.from(document.querySelectorAll('.rs-subtitle'));
  const cover = document.querySelector('.cover');
  const progress = document.querySelector('.progress');
  const byId = Object.fromEntries(scenes.map((el) => [el.dataset.sceneId, el]));
  let playing = false;

  function syncBgPhoto(photo, localT) {
    // Match HyperFrames CSS adapter: paused animation + negative delay = seek.
    const t = Math.max(0, Number(localT) || 0);
    photo.style.animationPlayState = 'paused';
    photo.style.animationDelay = (-t).toFixed(4) + 's';
  }

  function syncAllBgPhotos(time) {
    document.querySelectorAll('.bg-photo').forEach((photo) => {
      const start = Number(photo.dataset.start || 0);
      syncBgPhoto(photo, time - start);
    });
  }

  function syncSubtitles(time) {
    subtitles.forEach(function (subtitle) {
      const start = Number(subtitle.getAttribute('data-start') || 0);
      const duration = Number(subtitle.getAttribute('data-duration') || 0);
      const active = time >= start && time < start + duration;
      subtitle.style.opacity = active ? '1' : '0';
      subtitle.style.visibility = active ? 'visible' : 'hidden';
    });
  }

  function activate(sceneId, localT, duration) {
    for (const el of scenes) {
      const on = el.dataset.sceneId === sceneId;
      el.classList.toggle('is-active', on);
      if (on) {
        const p = Math.min(1, Math.max(0, localT / Math.max(0.001, duration)));
        el.style.setProperty('--p', String(p));
        const exitWindow = Math.min(0.35, Number(el.dataset.exitWindow || 0.12));
        const exit = p > 1 - exitWindow
          ? Math.min(1, Math.max(0, (p - (1 - exitWindow)) / Math.max(0.001, exitWindow)))
          : 0;
        el.style.setProperty('--exit', String(exit));
        const bgVideo = el.querySelector('.bg-video');
        if (bgVideo) {
          try {
            if (Math.abs((bgVideo.currentTime || 0) - localT) > 0.12) {
              bgVideo.currentTime = Math.max(0, localT);
            }
            if (playing && bgVideo.paused) bgVideo.play().catch(function () {});
            if (!playing && !bgVideo.paused) bgVideo.pause();
          } catch (_) { /* ignore seek races */ }
        }
        el.querySelectorAll('.list-item').forEach((item, i) => {
          const threshold = (i + 1) / (el.querySelectorAll('.list-item').length + 1);
          const show = p >= threshold * 0.85;
          item.style.opacity = show ? '1' : '0';
          item.style.transform = show ? 'translateY(0)' : 'translateY(24px)';
        });
        const bar = el.querySelector('.accent-bar, .underline');
        if (bar) bar.style.transform = 'scaleX(' + Math.min(1, p * 2.2) + ')';
        const stat = el.querySelector('.stat-num');
        if (stat) {
          const show = p > 0.08;
          stat.style.opacity = show ? '1' : '0';
          stat.style.transform = show ? 'scale(1)' : 'scale(0.7)';
        }
        const pill = el.querySelector('.cta-pill');
        if (pill) {
          const show = p > 0.25;
          pill.style.opacity = show ? '1' : '0';
          pill.style.transform = show ? 'translateY(0)' : 'translateY(16px)';
        }
        const opener = el.querySelector('.opener-text, .statement-text, .quote-text, .cta-text, .stat-text, .prod-kinetic-line, .prod-outro-tag, .prod-social-line, .prod-app-title, .prod-money-line, .prod-chart-line, .prod-yt-sub');
        if (opener) {
          // Become readable immediately — p=0 used to leave the first frame blank.
          const enter = Math.min(1, Math.max(0.35, p * 4));
          opener.style.opacity = String(enter);
          opener.style.transform = 'translateY(' + (1 - Math.min(1, p * 3)) * 14 + 'px)';
        }
        const prod = el.querySelector('.prod');
        if (prod) {
          const enter = Math.min(1, Math.max(0.45, p * 3.5));
          prod.style.opacity = String(enter);
        }
      } else {
        const bgVideo = el.querySelector('.bg-video');
        if (bgVideo && !bgVideo.paused) bgVideo.pause();
      }
    }
  }

  function syncAudio(time) {
    const frame = Math.max(0, Math.round(time * CFG.fps));
    const narrated = CFG.audioMix.narration.some(function (range) {
      return frame >= range.startFrame && frame < range.endFrame;
    });
    document.querySelectorAll('audio').forEach((audio) => {
      const start = Number(audio.dataset.start || 0);
      const duration = Number(audio.dataset.duration || 0);
      const baseVol = audio.dataset.volume != null && audio.dataset.volume !== ''
        ? Number(audio.dataset.volume)
        : 1;
      const local = time - start;
      let vol = baseVol;
      if (audio.dataset.role === 'music') {
        const fadeFrames = CFG.audioMix.fadeFrames;
        const fadeIn = fadeFrames > 0 ? Math.min(1, frame / fadeFrames) : 1;
        const remaining = Math.max(0, CFG.audioMix.totalFrames - frame);
        const fadeOut = fadeFrames > 0 ? Math.min(1, remaining / fadeFrames) : 1;
        vol = baseVol * Math.min(fadeIn, fadeOut) * (narrated ? CFG.audioMix.duckRatio : 1);
      } else if (audio.dataset.role === 'sfx') {
        const fade = 0.08;
        const fadeIn = Math.min(1, Math.max(0, local) / fade);
        const fadeOut = Math.min(1, Math.max(0, duration - local) / fade);
        vol = baseVol * Math.min(fadeIn, fadeOut);
      }
      audio.volume = Math.max(0, Math.min(1, vol));
      if (local < 0 || (duration > 0 && local > duration)) {
        if (!audio.paused) audio.pause();
        return;
      }
      if (Math.abs((audio.currentTime || 0) - local) > 0.12) {
        try { audio.currentTime = Math.max(0, local); } catch (_) { /* ignore seek races */ }
      }
      if (playing) {
        if (audio.paused) audio.play().catch(function () { /* autoplay blocked until gesture */ });
      } else if (!audio.paused) {
        audio.pause();
      }
    });
  }

  function seek(time) {
    const t = Math.max(0, Math.min(CFG.totalSeconds, time));
    root._t = t;
    syncAllBgPhotos(t);
    syncSubtitles(t);
    if (cover) {
      const inCover = CFG.coverSeconds > 0 && t < CFG.coverSeconds;
      cover.classList.toggle('is-active', inCover);
      if (inCover) {
        for (const el of scenes) el.classList.remove('is-active');
        if (progress && !CFG.hideProgressBar) progress.style.width = '0%';
        syncAudio(t);
        return;
      }
    }
    const contentT = t - (CFG.coverSeconds || 0);
    let active = CFG.beats[0];
    for (const beat of CFG.beats) {
      if (contentT >= beat.start) active = beat;
    }
    if (active) {
      const local = contentT - active.start;
      activate(active.id, local, active.duration);
    }
    if (progress && !CFG.hideProgressBar) {
      progress.style.width = (Math.min(1, t / CFG.totalSeconds) * 100) + '%';
    }
    syncAudio(t);
    seekCatalogTimelines(t);
  }

  function seekCatalogTimelines(t) {
    const tls = window.__timelines || {};
    // Drive both catalog hosts and cinematic motion stages.
    const hosts = root.querySelectorAll('[data-catalog-block], [data-motion-scene]');
    hosts.forEach(function (host) {
      const start = Number(host.closest('.scene')?.getAttribute('data-start') || host.getAttribute('data-start') || 0);
      const dur = Number(host.closest('.scene')?.getAttribute('data-duration') || host.getAttribute('data-duration') || 0);
      const motionId = host.getAttribute('data-motion-scene');
      const blockId = host.getAttribute('data-catalog-block') || '';
      const sceneId = host.closest('.scene')?.getAttribute('data-scene-id') || '';
      const compHost = host.querySelector ? host.querySelector('[data-composition-id]') : null;
      const compId = (compHost && compHost.getAttribute('data-composition-id')) || blockId;
      const tl = tls[motionId] || tls[sceneId] || tls[compId] || tls[blockId];
      if (!tl || typeof tl.seek !== 'function') return;
      const local = t - start;
      let tlDur = 0;
      try { tlDur = typeof tl.duration === 'function' ? Number(tl.duration()) || 0 : Number(tl.duration) || 0; } catch (_) { tlDur = 0; }
      if (local < 0 || dur <= 0) {
        try { tl.pause && tl.pause(); tl.seek(0); } catch (_) { /* ignore */ }
        return;
      }
      // Play entrance timelines in real time (not stretched across the whole
      // scene). Long dialogue beats then hold the settled pose so captions
      // stay readable instead of looking like blank mood washes.
      // When paused at the scene head, park on a settled readable pose.
      let seekTo = local;
      if (tlDur > 0) {
        if (!playing && local < 0.06) seekTo = Math.min(tlDur, 1.05);
        else seekTo = Math.max(0, Math.min(tlDur, local));
      }
      try {
        tl.pause && tl.pause();
        tl.seek(seekTo);
      } catch (_) { /* ignore */ }
    });
  }

  // HyperFrames / preview: expose seek API used by player + frame adapters.
  window.__reelSeek = seek;
  window.__reelDuration = CFG.totalSeconds;
  window.__reelFps = CFG.fps;
  window.__reelSetPlaying = function (next) {
    playing = !!next;
    syncAudio(root._t || 0);
  };

  // Frame-adapter style hook: in-editor iframe preview seeks via currentTime.
  Object.defineProperty(root, 'currentTime', {
    configurable: true,
    get() { return root._t || 0; },
    set(v) { root._t = Number(v) || 0; seek(root._t); },
  });

  /**
   * HyperFrames capture calls window.__hf.seek → __player.renderSeek, which
   * drives window.__timelines[compositionId]. Without a timeline (and without
   * hooking seek), only the initial seek(0) scene stays visible while audio
   * still muxes for the full duration.
   */
  let tlTime = 0;
  const timeline = {
    duration() { return CFG.totalSeconds; },
    time(v) {
      if (arguments.length) {
        tlTime = Math.max(0, Number(v) || 0);
        seek(tlTime);
        return this;
      }
      return tlTime;
    },
    totalTime(v) {
      if (arguments.length) {
        tlTime = Math.max(0, Number(v) || 0);
        seek(tlTime);
        return this;
      }
      return tlTime;
    },
    seek(v) {
      tlTime = Math.max(0, Number(v) || 0);
      seek(tlTime);
      return this;
    },
    pause() { return this; },
    play() { return this; },
    paused() { return true; },
    progress(v) {
      if (arguments.length) {
        tlTime = (Number(v) || 0) * CFG.totalSeconds;
        seek(tlTime);
        return this;
      }
      return CFG.totalSeconds > 0 ? tlTime / CFG.totalSeconds : 0;
    },
    timeScale() { return 1; },
    getChildren() { return []; },
  };
  window.__timelines = window.__timelines || {};
  window.__timelines.reel = timeline;

  function patchHfSeek() {
    const player = window.__player;
    if (player && typeof player.renderSeek === 'function' && !player.__reelSeekPatched) {
      const orig = player.renderSeek.bind(player);
      player.renderSeek = function (t, options) {
        const result = orig(t, options);
        seek(Math.max(0, Number(t) || 0));
        return result;
      };
      player.__reelSeekPatched = true;
    }
    // Bridge may overwrite window.__hf.seek after we wrap it — re-wrap when needed.
    const hf = window.__hf;
    if (hf && typeof hf.seek === 'function' && !hf.seek.__reelWrapped) {
      const origHf = hf.seek.bind(hf);
      const wrapped = function (t, options) {
        const result = origHf(t, options);
        seek(Math.max(0, Number(t) || 0));
        return result;
      };
      wrapped.__reelWrapped = true;
      hf.seek = wrapped;
    }
  }
  patchHfSeek();
  const patchIv = setInterval(patchHfSeek, 50);
  setTimeout(function () { clearInterval(patchIv); }, 60000);
  window.addEventListener('hf-seek', function (ev) {
    const t = ev && ev.detail ? Number(ev.detail.time) : NaN;
    if (Number.isFinite(t)) seek(t);
  });

  // GSAP-less wall-clock preview when not under the HyperFrames capture loop.
  let raf = 0;
  let startWall = 0;
  let startT = 0;
  function tick(now) {
    if (!playing) return;
    const elapsed = (now - startWall) / 1000;
    const next = startT + elapsed;
    if (next >= CFG.totalSeconds) {
      seek(CFG.totalSeconds);
      playing = false;
      syncAudio(CFG.totalSeconds);
      return;
    }
    seek(next);
    raf = requestAnimationFrame(tick);
  }
  window.__reelPlay = function () {
    playing = true;
    startWall = performance.now();
    startT = root._t || 0;
    syncAudio(startT);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  };
  window.__reelPause = function () {
    playing = false;
    cancelAnimationFrame(raf);
    syncAudio(root._t || 0);
  };

  function fitStage() {
    const wrap = document.getElementById('fit-wrap');
    if (!wrap) return;
    // During HyperFrames export capture the viewport is the stage size —
    // leave the authored canvas unscaled so screenshots stay full-bleed.
    if (window.__HF_EXPORT_RENDER_SEEK_CONFIG || window.__hf && window.__hf.seek) {
      wrap.style.width = '';
      wrap.style.height = '';
      root.style.transform = '';
      return;
    }
    const w = Number(root.getAttribute('data-width')) || 1080;
    const h = Number(root.getAttribute('data-height')) || 1920;
    const scale = Math.min(window.innerWidth / w, window.innerHeight / h);
    wrap.style.width = (w * scale) + 'px';
    wrap.style.height = (h * scale) + 'px';
    root.style.transform = 'scale(' + scale + ')';
  }
  window.addEventListener('resize', fitStage);
  fitStage();

  seek(0);
})();
</script>`;
}

/**
 * Serialize ReelProps into a standalone HyperFrames HTML document.
 *
 * @param inlineCatalog When true (editor preview), embed catalog block markup
 *   into the host so srcDoc iframes work without a compositions/ folder.
 *   Producer renders should leave this false and rely on data-composition-src.
 */
export function buildHyperframesCompositionHtml(
  props: ReelProps,
  opts: {
    inlineCatalog?: boolean;
    producerMode?: boolean;
    runtimeUrl?: string;
  } = {},
): string {
  const inlineCatalog = opts.inlineCatalog === true;
  const fps = props.fps || 30;
  const width = props.width || 1080;
  const height = props.height || 1920;
  const layout = props.layout ?? resolveProductionLayout({ width, height });
  const tokens = props.tokens;
  const accent = tokens.accent ?? "#ff6b4a";
  const cover = coverFrames(fps, Boolean(props.coverUrl));
  const coverSeconds = framesToSeconds(cover, fps);
  const styleId = normalizeStyleId(props.styleId ?? DEFAULT_STYLE_ID);
  const energy = normalizeEnergyId(props.energy ?? DEFAULT_ENERGY_ID);
  const chrome = getStyleChrome(styleId);
  const motion = getMotionRecipe(styleId, energy);
  const transitionFrames = getTransitionFrames(styleId, energy, fps);
  const transitionClass = `style-${chrome.transition}`;
  const hideProgress =
    props.hideProgressBar === true ? true : chrome.preferHideProgressBar;
  const motionStiffness = (motion.stiffness / 100).toFixed(2);

  const beats: Array<{ id: string; start: number; duration: number }> = [];
  const sceneBlocks: string[] = [];
  const timeline = props.timeline as ReelBeat[];

  // Match Remotion: hold each scene until the next beat starts so inter-beat
  // voice gaps (silence between takes) never show a blank frame.
  for (let i = 0; i < timeline.length; i++) {
    const beat = timeline[i];
    const scene = props.scenes.find((s) => s.id === beat.sceneId);
    if (!scene) continue;
    const next = timeline[i + 1];
    const endFrame = next
      ? next.startFrame
      : beat.startFrame + beat.durationFrames;
    const holdFrames = Math.max(1, endFrame - beat.startFrame);
    const start = framesToSeconds(beat.startFrame, fps);
    const duration = framesToSeconds(holdFrames, fps);
    beats.push({ id: scene.id, start, duration });
    const absoluteStart = start + coverSeconds;
    const exitWindow = Math.min(
      0.35,
      framesToSeconds(transitionFrames, fps) / Math.max(0.05, duration),
    );

    if (props.preset) {
      const presetScene = buildHyperframesPresetScene(props.preset.id, {
        scene,
        tokens,
        absoluteStart,
        duration,
        exitWindow,
        transitionClass,
        motionStiffness,
      });
      if (presetScene) {
        sceneBlocks.push(presetScene);
        continue;
      }
    }

    const catalog = getCatalogBlockByTemplateId(scene.templateId);
    if (catalog) {
      const built = buildCatalogSceneBlock({
        scene,
        tokens,
        absoluteStart,
        duration,
        exitWindow,
        transitionClass,
        accent,
        motionStiffness,
        inline: inlineCatalog,
        backgroundHtml: backgroundLayer(scene, absoluteStart, duration),
      });
      if (built) {
        sceneBlocks.push(built.html);
        continue;
      }
    }

    sceneBlocks.push(`
      <section id="scene-${escapeHtml(scene.id)}" class="clip scene ${transitionClass}${scene.background?.type === "image" || scene.background?.type === "video" ? " has-photo" : ""}" data-scene-id="${escapeHtml(scene.id)}"
               data-start="${absoluteStart.toFixed(3)}"
               data-duration="${duration.toFixed(3)}"
               data-track-index="1"
               data-exit-window="${exitWindow.toFixed(3)}"
               style="--accent:${accent};--motion-stiffness:${motionStiffness}">
        ${backgroundLayer(scene, absoluteStart, duration)}
        ${buildCinematicClassicVisual({
          scene,
          tokens,
          innerHtml: sceneInnerHtml(scene, tokens),
        })}
      </section>`);
  }

  const contentDuration =
    beats.reduce((max, b) => Math.max(max, b.start + b.duration), 0) || 1;
  const totalSeconds = contentDuration + coverSeconds;
  const totalFrames = Math.max(1, Math.round(totalSeconds * fps));
  const audioMix = buildAudioMixPlan({
    fps,
    totalFrames,
    musicVolume: props.musicVolume,
    narration: props.audioUrl
      ? props.timeline.map((beat) => ({
          startFrame: cover + beat.startFrame,
          durationFrames: beat.durationFrames,
        }))
      : [],
  });

  const audioTags: string[] = [];
  if (props.audioUrl) {
    audioTags.push(
      `<audio id="vo" preload="auto" data-role="voice" data-start="${coverSeconds.toFixed(3)}" data-duration="${contentDuration.toFixed(3)}" data-track-index="10" src="${escapeHtml(props.audioUrl)}"></audio>`,
    );
  }
  if (props.musicUrl) {
    const vol = Math.max(0, Math.min(1, (props.musicVolume ?? 20) / 100));
    audioTags.push(
      `<audio id="music" preload="auto" data-role="music" data-start="0" data-duration="${totalSeconds.toFixed(3)}" data-track-index="11" data-volume="${vol}" data-fade-in="${audioMix.fadeFrames}" data-fade-out="${audioMix.fadeFrames}" src="${escapeHtml(props.musicUrl)}"></audio>`,
    );
  }
  const fpsSafe = Math.max(1, fps);
  for (const [i, cue] of (props.sfxCues ?? []).entries()) {
    const startSec = coverSeconds + cue.startFrame / fpsSafe;
    audioTags.push(
      `<audio id="sfx-${i}" preload="auto" data-role="sfx" data-start="${startSec.toFixed(3)}" data-duration="2" data-track-index="${12 + i}" data-volume="${Math.max(0, Math.min(1, cue.volume)).toFixed(3)}" src="${escapeHtml(cue.url)}"></audio>`,
    );
  }

  const coverBlock = props.coverUrl
    ? `<div class="cover" data-start="0" data-duration="${coverSeconds.toFixed(3)}" data-track-index="0" style="background-image:url('${escapeHtml(props.coverUrl)}')"></div>`
    : "";

  const progress = hideProgress
    ? ""
    : `<div class="progress" style="background:${accent}"></div>`;

  const captionBlocks =
    props.captions?.enabled === true
      ? props.captions.cues
          .map((cue, index) => {
            const start = coverSeconds + cue.startFrame / fpsSafe;
            const duration =
              Math.max(1, cue.endFrame - cue.startFrame) / fpsSafe;
            return `<div class="clip rs-subtitle" data-start="${start.toFixed(3)}" data-duration="${duration.toFixed(3)}" data-track-index="20" aria-label="Subtitle ${index + 1}"><span>${escapeHtml(cue.text)}</span></div>`;
          })
          .join("\n")
      : "";

  const grainAttr = chrome.grainOpacity > 0 ? "1" : "0";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Reel Studio · HyperFrames</title>
  <style>${STYLES}${HYPERFRAMES_PRESET_STYLES}
    .rs-subtitle{position:absolute;z-index:50;left:var(--safe-left);right:var(--safe-right);bottom:var(--caption-bottom);display:flex;justify-content:center;pointer-events:none;${opts.producerMode ? "" : "opacity:0;visibility:hidden"}}
    .rs-subtitle>span{max-width:var(--caption-max-width);padding:.42em .68em;border-radius:18px;background:rgba(8,10,16,.82);color:#fff;font:700 calc(38px * var(--type-scale))/1.18 var(--font,system-ui,sans-serif);text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.28)}
  </style>
</head>
<body>
  <div id="fit-wrap"
       data-composition-id="reel"
       data-no-timeline
       data-start="0"
       data-duration="${totalSeconds.toFixed(3)}"
       data-width="${width}"
       data-height="${height}"
       data-fps="${fps}"
       style="width:${width}px;height:${height}px">
    <div id="root"
         data-total-frames="${totalFrames}"
         data-style="${styleId}"
         data-energy="${energy}"
         data-hide-progress="${hideProgress ? "1" : "0"}"
         data-grain="${grainAttr}"
         data-orientation="${layout.orientation}"
         style="width:${width}px;height:${height}px;--accent:${accent};--grain-opacity:${chrome.grainOpacity};--motion-stiffness:${motionStiffness};--safe-top:${layout.safeArea.top}px;--safe-right:${layout.safeArea.right}px;--safe-bottom:${layout.safeArea.bottom}px;--safe-left:${layout.safeArea.left}px;--content-max-width:${layout.contentMaxWidth}px;--caption-max-width:${layout.captionMaxWidth}px;--caption-bottom:${layout.captionBottom}px;--type-scale:${layout.typeScale}">
      ${coverBlock}
      ${progress}
      ${sceneBlocks.join("\n")}
      ${captionBlocks}
      ${audioTags.join("\n")}
    </div>
  </div>
  ${buildGsapMotionBootScript(opts.runtimeUrl)}
  ${opts.producerMode ? "" : buildSeekScript(beats, coverSeconds, totalSeconds, fps, hideProgress, audioMix)}
</body>
</html>`;
}

export function compositionTotalFrames(props: ReelProps): number {
  const fps = props.fps || 30;
  const cover = coverFrames(fps, Boolean(props.coverUrl));
  const content = props.timeline.reduce(
    (max, b) => Math.max(max, b.startFrame + b.durationFrames),
    0,
  );
  return Math.max(1, content + cover);
}
