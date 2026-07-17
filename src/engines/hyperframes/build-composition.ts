/**
 * Build a HyperFrames HTML composition from ReelProps.
 * Deterministic, seekable CSS + GSAP motion — no Remotion imports.
 */

import type { BrandTokens } from "@/compositions/tokens";
import type { ReelBeat, ReelProps, ReelScene, SceneMood } from "@/compositions/types";
import { coverFrames } from "@/compositions/types";
import { normalizeHfTemplateId } from "@/engines/hyperframes/templates";

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

  if (scene.hideText) {
    return `<div class="scene-blank"></div>`;
  }

  switch (templateId) {
    case "hf-opener":
      return `
        <div class="tpl tpl-opener">
          <div class="accent-bar" style="background:${accent}"></div>
          <p class="opener-text" style="color:${fg}">${textHtml}</p>
        </div>`;
    case "hf-statement":
      return `
        <div class="tpl tpl-statement">
          <p class="statement-text" style="color:${fg}">${textHtml}</p>
          <div class="underline" style="background:${accent}"></div>
        </div>`;
    case "hf-list": {
      const items = listItems(scene);
      const marker = visual || "→";
      return `
        <div class="tpl tpl-list">
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
          <div class="stat-num" style="color:${accent}">${visual || "—"}</div>
          <p class="stat-text" style="color:${fg}">${textHtml}</p>
        </div>`;
    case "hf-quote":
      return `
        <div class="tpl tpl-quote">
          <div class="qmark" style="color:${accent}">“</div>
          <p class="quote-text" style="color:${fg}">${textHtml}</p>
          ${visual ? `<p class="quote-attr" style="color:${fg}">— ${visual}</p>` : ""}
        </div>`;
    case "hf-cta":
      return `
        <div class="tpl tpl-cta">
          <p class="cta-text" style="color:${fg}">${textHtml}</p>
          <div class="cta-pill" style="background:${accent};color:#0b0f19">
            ${visual || "Follow"}
          </div>
          ${
            tokens.handle
              ? `<p class="cta-handle" style="color:${fg}">@${escapeHtml(tokens.handle)}</p>`
              : ""
          }
        </div>`;
    default:
      return `
        <div class="tpl tpl-statement">
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
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;700;800&family=Instrument+Serif:ital@0;1&display=swap');
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
    justify-content: stretch; opacity: 1; visibility: hidden;
  }
  .scene.is-active { visibility: visible; }
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
    background: linear-gradient(180deg, rgba(5,7,13,.35) 0%, rgba(5,7,13,.72) 100%);
  }
  .content {
    position: relative; z-index: 2; flex: 1;
    display: flex; align-items: center; justify-content: center;
    padding: 10% 8%;
  }
  .em { color: inherit; box-shadow: inset 0 -0.22em 0 0 var(--accent, #ff6b4a); }
  .tpl { width: 100%; max-width: 92%; }
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
`;

function buildSeekScript(
  beats: Array<{ id: string; start: number; duration: number }>,
  coverSeconds: number,
  totalSeconds: number,
  fps: number,
  hideProgressBar: boolean,
): string {
  const payload = JSON.stringify({ beats, coverSeconds, totalSeconds, fps, hideProgressBar });
  return `
<script>
(function () {
  const CFG = ${payload};
  const root = document.getElementById('root');
  const scenes = Array.from(document.querySelectorAll('.scene'));
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

  function activate(sceneId, localT, duration) {
    for (const el of scenes) {
      const on = el.dataset.sceneId === sceneId;
      el.classList.toggle('is-active', on);
      if (on) {
        const p = Math.min(1, Math.max(0, localT / Math.max(0.001, duration)));
        el.style.setProperty('--p', String(p));
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
        const opener = el.querySelector('.opener-text, .statement-text, .quote-text, .cta-text, .stat-text');
        if (opener) {
          opener.style.opacity = String(Math.min(1, p * 3));
          opener.style.transform = 'translateY(' + (1 - Math.min(1, p * 2.5)) * 18 + 'px)';
        }
      } else {
        const bgVideo = el.querySelector('.bg-video');
        if (bgVideo && !bgVideo.paused) bgVideo.pause();
      }
    }
  }

  function syncAudio(time) {
    document.querySelectorAll('audio').forEach((audio) => {
      const start = Number(audio.dataset.start || 0);
      const duration = Number(audio.dataset.duration || 0);
      const vol = audio.dataset.volume;
      if (vol != null && vol !== '') audio.volume = Math.max(0, Math.min(1, Number(vol)));
      const local = time - start;
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
 */
export function buildHyperframesCompositionHtml(props: ReelProps): string {
  const fps = props.fps || 30;
  const width = props.width || 1080;
  const height = props.height || 1920;
  const tokens = props.tokens;
  const accent = tokens.accent ?? "#ff6b4a";
  const cover = coverFrames(fps, Boolean(props.coverUrl));
  const coverSeconds = framesToSeconds(cover, fps);

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
    sceneBlocks.push(`
      <section class="scene" data-scene-id="${escapeHtml(scene.id)}"
               data-start="${absoluteStart.toFixed(3)}"
               data-duration="${duration.toFixed(3)}"
               data-track-index="1"
               style="--accent:${accent}">
        ${backgroundLayer(scene, absoluteStart, duration)}
        <div class="content">${sceneInnerHtml(scene, tokens)}</div>
      </section>`);
  }

  const contentDuration =
    beats.reduce((max, b) => Math.max(max, b.start + b.duration), 0) || 1;
  const totalSeconds = contentDuration + coverSeconds;
  const totalFrames = Math.max(1, Math.round(totalSeconds * fps));

  const audioTags: string[] = [];
  if (props.audioUrl) {
    audioTags.push(
      `<audio id="vo" preload="auto" data-start="${coverSeconds.toFixed(3)}" data-duration="${contentDuration.toFixed(3)}" data-track-index="10" src="${escapeHtml(props.audioUrl)}"></audio>`,
    );
  }
  if (props.musicUrl) {
    const vol = Math.max(0, Math.min(1, (props.musicVolume ?? 20) / 100));
    audioTags.push(
      `<audio id="music" preload="auto" data-start="0" data-duration="${totalSeconds.toFixed(3)}" data-track-index="11" data-volume="${vol}" src="${escapeHtml(props.musicUrl)}"></audio>`,
    );
  }

  const coverBlock = props.coverUrl
    ? `<div class="cover" data-start="0" data-duration="${coverSeconds.toFixed(3)}" data-track-index="0" style="background-image:url('${escapeHtml(props.coverUrl)}')"></div>`
    : "";

  const progress = props.hideProgressBar
    ? ""
    : `<div class="progress" style="background:${accent}"></div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Reel Studio · HyperFrames</title>
  <style>${STYLES}</style>
</head>
<body>
  <div id="fit-wrap">
    <div id="root"
         data-composition-id="reel"
         data-no-timeline
         data-start="0"
         data-duration="${totalSeconds.toFixed(3)}"
         data-width="${width}"
         data-height="${height}"
         data-fps="${fps}"
         data-total-frames="${totalFrames}"
         style="width:${width}px;height:${height}px;--accent:${accent}">
      ${coverBlock}
      ${progress}
      ${sceneBlocks.join("\n")}
      ${audioTags.join("\n")}
    </div>
  </div>
  ${buildSeekScript(beats, coverSeconds, totalSeconds, fps, Boolean(props.hideProgressBar))}
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
