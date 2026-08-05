import type { BrandTokens } from "@/compositions/tokens";
import type { ReelScene, SceneMood } from "@/compositions/types";
import type { HfCatalogBlockMeta } from "@/engines/hyperframes/catalog/manifest";

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
      `<em class="em">${safe}</em>`,
    );
  }
  return html;
}

/** Pack copy into short display lines so type never wraps mid-animation. */
function packLines(
  text: string,
  maxChars = 18,
  maxWordsPerLine = 99,
): string[] {
  const words = text
    .replace(/\n+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let cur = "";
  let curWords = 0;
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (
      cur &&
      (next.length > maxChars || curWords >= maxWordsPerLine)
    ) {
      lines.push(cur);
      cur = w;
      curWords = 1;
    } else {
      cur = next;
      curWords += 1;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 7);
}

function lineStackHtml(
  text: string,
  emphasis: string[],
  maxChars = 18,
  lineClass = "fx-line",
  maxWordsPerLine = 99,
): string {
  return packLines(text, maxChars, maxWordsPerLine)
    .map(
      (line, i) =>
        `<div class="${lineClass}" data-li="${i}"><span class="fx-line-inner">${emphasize(line, emphasis)}</span></div>`,
    )
    .join("");
}

function linesToItems(text: string): string[] {
  return text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

type Palette = {
  a: string;
  b: string;
  c: string;
  glow: string;
  ink: string;
  muted: string;
};

const MOOD_PALETTES: Record<SceneMood | "default", Palette> = {
  dramatic: {
    a: "#0a0406",
    b: "#2a0a12",
    c: "#ff2d55",
    glow: "#ff6b8a",
    ink: "#fff5f7",
    muted: "rgba(255,245,247,0.55)",
  },
  energetic: {
    a: "#120804",
    b: "#3a1606",
    c: "#ff7a18",
    glow: "#ffd060",
    ink: "#fff8ef",
    muted: "rgba(255,248,239,0.55)",
  },
  tech: {
    a: "#020617",
    b: "#0a1e36",
    c: "#22d3ee",
    glow: "#67e8f9",
    ink: "#e8fbff",
    muted: "rgba(232,251,255,0.55)",
  },
  inspiring: {
    a: "#0c0914",
    b: "#24183a",
    c: "#f6c177",
    glow: "#ffe0a3",
    ink: "#fff9ef",
    muted: "rgba(255,249,239,0.55)",
  },
  calm: {
    a: "#061216",
    b: "#0d3036",
    c: "#5eead4",
    glow: "#99f6e4",
    ink: "#f0fffe",
    muted: "rgba(240,255,254,0.55)",
  },
  playful: {
    a: "#140818",
    b: "#3a1548",
    c: "#f472b6",
    glow: "#fb7185",
    ink: "#fff5fb",
    muted: "rgba(255,245,251,0.55)",
  },
  nature: {
    a: "#04110a",
    b: "#0f2f1c",
    c: "#86efac",
    glow: "#bbf7d0",
    ink: "#f3fff6",
    muted: "rgba(243,255,246,0.55)",
  },
  default: {
    a: "#07070c",
    b: "#16122a",
    c: "#ff6b4a",
    glow: "#ff8f6b",
    ink: "#f8fafc",
    muted: "rgba(248,250,252,0.55)",
  },
};

function paletteFor(mood?: SceneMood): Palette {
  return (mood && MOOD_PALETTES[mood]) || MOOD_PALETTES.default;
}

/** Parse a count-up target from visual/text (90%, 10x, $10k). */
function parseMoneyTargetLocal(visual: string | undefined, text: string): number {
  const blob = `${visual ?? ""} ${text}`;
  const m = blob.match(
    /\$?\s*([\d]{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*([kKmMbB])?/,
  );
  if (!m) return 100;
  let n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return 100;
  const suffix = (m[2] ?? "").toLowerCase();
  if (suffix === "k") n *= 1_000;
  if (suffix === "m") n *= 1_000_000;
  if (suffix === "b") n *= 1_000_000_000;
  return Math.max(1, Math.round(n));
}

function speakerLabel(visual?: string): string {
  if (!visual) return "";
  if (/^(interviewer|candidate|host|guest)$/i.test(visual.trim())) {
    return visual.trim().toUpperCase();
  }
  return "";
}

function hashHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

/**
 * Completely distinct stage shells — not the same orb stack recolored.
 * Each recipe is a different production layout language.
 */
function stageShell(
  sceneId: string,
  pal: Palette,
  recipe: string,
  extraClass = "",
): string {
  const hue = hashHue(sceneId);
  const common = `class="fx-stage ${extraClass} recipe-${recipe}" data-motion-scene="${escapeHtml(sceneId)}" data-recipe="${recipe}" style="--fx-a:${pal.a};--fx-b:${pal.b};--fx-c:${pal.c};--fx-glow:${pal.glow};--fx-ink:${pal.ink};--fx-muted:${pal.muted};--fx-hue:${hue}"`;

  switch (recipe) {
    case "void-slash":
      return `<div ${common}>
        <div class="fx-void"></div>
        <div class="fx-void-panel" aria-hidden="true"></div>
        <div class="fx-slash" aria-hidden="true"></div>
        <div class="fx-slash fx-slash-2" aria-hidden="true"></div>
        <div class="fx-grain"></div>
        <div class="fx-letterbox top"></div>
        <div class="fx-letterbox bot"></div>`;

    case "editorial":
      return `<div ${common}>
        <div class="fx-paper"></div>
        <div class="fx-paper-rule" aria-hidden="true"></div>
        <div class="fx-paper-corner" aria-hidden="true"></div>
        <div class="fx-grain soft"></div>`;

    case "lower-third":
      return `<div ${common}>
        <div class="fx-studio"></div>
        <div class="fx-studio-beam" aria-hidden="true"></div>
        <div class="fx-floor-glow" aria-hidden="true"></div>
        <div class="fx-grain"></div>
        <div class="fx-letterbox top"></div>
        <div class="fx-letterbox bot"></div>`;

    case "punch-block":
      return `<div ${common}>
        <div class="fx-block-a"></div>
        <div class="fx-block-b"></div>
        <div class="fx-block-flash"></div>
        <div class="fx-grain"></div>`;

    case "terminal":
      return `<div ${common}>
        <div class="fx-term-bg"></div>
        <div class="fx-term-grid" aria-hidden="true"></div>
        <div class="fx-term-scan" aria-hidden="true"></div>
        <div class="fx-grain"></div>`;

    case "stack-cards":
      return `<div ${common}>
        <div class="fx-deep"></div>
        <div class="fx-deep-orb" aria-hidden="true"></div>
        <div class="fx-grain"></div>`;

    case "billboard":
      return `<div ${common}>
        <div class="fx-bill-bg"></div>
        <div class="fx-bill-shine" aria-hidden="true"></div>
        <div class="fx-grain soft"></div>`;

    case "minimal-mark":
      return `<div ${common}>
        <div class="fx-min-bg"></div>
        <div class="fx-min-ring" aria-hidden="true"></div>
        <div class="fx-grain soft"></div>`;

    case "social-plate":
      return `<div ${common}>
        <div class="fx-social-bg"></div>
        <div class="fx-social-blob" aria-hidden="true"></div>
        <div class="fx-grain"></div>`;

    default:
      return `<div ${common}>
        <div class="fx-void"></div>
        <div class="fx-grain"></div>`;
  }
}

function recipeForTemplate(templateId: string, mood?: SceneMood): string {
  switch (templateId) {
    case "hf-kinetic-slam":
    case "caption-kinetic-slam":
      return mood === "tech" ? "terminal" : "void-slash";
    case "hf-quote":
      return "editorial";
    case "hf-opener":
      return "lower-third";
    case "hf-statement":
      return mood === "dramatic" ? "punch-block" : "billboard";
    case "hf-list":
      return "stack-cards";
    case "hf-stat":
    case "apple-money-count":
      return "billboard";
    case "hf-logo-outro":
    case "logo-outro":
      return "minimal-mark";
    case "hf-ig-follow":
    case "hf-tt-follow":
    case "instagram-follow":
    case "tiktok-follow":
    case "hf-cta":
      return "social-plate";
    case "hf-yt-lower-third":
    case "yt-lower-third":
      return "lower-third";
    case "data-chart":
      return "stack-cards";
    case "app-showcase":
      return "terminal";
    default:
      return "void-slash";
  }
}

function chipHtml(speaker: string, accent: string, ink: string): string {
  if (!speaker) return "";
  return `<p class="fx-chip" style="--chip:${accent};color:${ink}">${escapeHtml(speaker)}</p>`;
}

/**
 * Portrait-native HyperFrames visuals — production layouts, not mood washes.
 */
export function buildNativeCatalogVisual(args: {
  meta: HfCatalogBlockMeta;
  scene: ReelScene;
  tokens: BrandTokens;
}): string | null {
  const { meta, scene, tokens } = args;
  const pal = paletteFor(scene.mood);
  const accent = tokens.accent ?? pal.c;
  const handle = tokens.handle?.replace(/^@/, "") || "yourbrand";
  const textHtml = emphasize(scene.text, scene.emphasis).replace(/\n/g, "<br/>");
  const lines = lineStackHtml(scene.text, scene.emphasis, 12, "fx-line", 3);
  const sid = scene.id;
  const recipe = recipeForTemplate(meta.id, scene.mood);

  switch (meta.id) {
    case "caption-kinetic-slam":
      return `
        ${stageShell(sid, pal, recipe, "fx-kinetic")}
          <div class="fx-content fx-content-slam">
            <p class="fx-kicker" style="color:${accent}">HOOK</p>
            <h2 class="fx-stack slam-stack" style="color:${pal.ink}">${lines}</h2>
            <div class="fx-rule" style="background:${accent}"></div>
          </div>
        </div>`;

    case "logo-outro":
      return `
        ${stageShell(sid, pal, "minimal-mark", "fx-outro")}
          <div class="fx-content">
            <div class="fx-logo-mark" style="border-color:${accent};color:${pal.ink}">${escapeHtml(handle.slice(0, 1).toUpperCase())}</div>
            <div class="fx-stack outro-stack" style="color:${pal.ink}">${lineStackHtml(scene.text, scene.emphasis, 22, "fx-line serif")}</div>
            <p class="fx-pill" style="color:${pal.ink}">${escapeHtml(scene.visual || `${handle}.com`)}</p>
          </div>
        </div>`;

    case "instagram-follow":
    case "tiktok-follow": {
      const network = meta.id === "instagram-follow" ? "Instagram" : "TikTok";
      const cta = escapeHtml(scene.visual || "Follow");
      return `
        ${stageShell(sid, pal, "social-plate", "fx-social")}
          <div class="fx-content fx-content-end">
            <div class="fx-stack social-stack" style="color:${pal.ink}">${lineStackHtml(scene.text, scene.emphasis, 20)}</div>
            <div class="fx-social-card">
              <div class="fx-avatar" style="background:${accent}">${escapeHtml(handle.slice(0, 1).toUpperCase())}</div>
              <div class="fx-social-meta">
                <p class="fx-social-name" style="color:${pal.ink}">${escapeHtml(handle)}</p>
                <p class="fx-social-net">${network}</p>
              </div>
              <div class="fx-social-btn" style="background:${accent}">${cta}</div>
            </div>
          </div>
        </div>`;
    }

    case "yt-lower-third":
      return `
        ${stageShell(sid, pal, "lower-third", "fx-yt")}
          <div class="fx-content fx-content-end">
            <div class="fx-yt-bar">
              <div class="fx-avatar round" style="background:${accent}">${escapeHtml(handle.slice(0, 1).toUpperCase())}</div>
              <div>
                <p class="fx-yt-name" style="color:${pal.ink}">${escapeHtml(handle)}</p>
                <p class="fx-yt-sub" style="color:${pal.ink}">${textHtml}</p>
              </div>
              <div class="fx-yt-btn">${escapeHtml(scene.visual || "Subscribe")}</div>
            </div>
          </div>
        </div>`;

    case "apple-money-count": {
      // Dark cinematic stage (not cream billboard) so proof beats match tech reels.
      const visual = escapeHtml(scene.visual || "$10,000");
      const target = parseMoneyTargetLocal(scene.visual, scene.text);
      const suffix = /%/.test(scene.visual || "")
        ? "%"
        : /×|x/i.test(scene.visual || scene.text)
          ? "×"
          : "";
      return `
        ${stageShell(sid, pal, "punch-block", "fx-money")}
          <div class="fx-content">
            <p class="fx-kicker" style="color:${accent}">PROOF</p>
            <p class="fx-money-num" data-count-to="${target}" data-count-suffix="${suffix}" style="color:${pal.ink}">${visual}</p>
            <p class="fx-money-line" style="color:${pal.ink}">${textHtml}</p>
            <div class="fx-rule" style="background:${accent}"></div>
          </div>
        </div>`;
    }

    case "data-chart": {
      // Prefer explicit items as series; normalize heights to max so bars read as growth.
      const fromItems = (scene.items ?? [])
        .map((v) => Number(String(v).replace(/[^\d.]/g, "")))
        .filter((n) => Number.isFinite(n) && n > 0);
      const fromBlob =
        [scene.visual || "", scene.text]
          .join(" ")
          .match(/(\d+(?:\.\d+)?)/g)
          ?.map(Number)
          .filter((n) => Number.isFinite(n) && n > 0) ?? [];
      const nums = (fromItems.length >= 3 ? fromItems : fromBlob).slice(0, 6);
      const max = nums.length ? Math.max(...nums) : 1;
      const heights =
        nums.length >= 3
          ? nums.map(
              (n) =>
                `${Math.max(22, Math.min(96, Math.round((n / max) * 96)))}%`,
            )
          : ["42%", "58%", "51%", "73%", "88%", "96%"];
      while (heights.length < 6) heights.push(heights[heights.length - 1] || "60%");
      return `
        ${stageShell(sid, pal, "terminal", "fx-chart")}
          <div class="fx-content">
            <p class="fx-chart-title" style="color:${pal.ink}">${escapeHtml(scene.visual || scene.text.slice(0, 48))}</p>
            <div class="fx-chart-bars">
              ${heights.map((h) => `<i style="--h:${h};background:linear-gradient(180deg, ${accent}, ${pal.b})"></i>`).join("")}
            </div>
            <p class="fx-chart-line" style="color:${pal.ink}">${textHtml}</p>
          </div>
        </div>`;
    }
    case "app-showcase":
      return `
        ${stageShell(sid, pal, "terminal", "fx-app")}
          <div class="fx-content">
            <div class="fx-phone">
              <div class="fx-phone-screen">
                <div class="fx-phone-shine"></div>
                <p class="fx-phone-cta" style="background:${accent}">${escapeHtml(scene.visual || "START NOW")}</p>
              </div>
            </div>
            <div class="fx-stack" style="color:${pal.ink}">${lineStackHtml(scene.text, scene.emphasis, 14)}</div>
          </div>
        </div>`;

    default:
      return null;
  }
}

/**
 * Cinematic classic scenes — each template is a different ad unit.
 */
export function buildCinematicClassicVisual(args: {
  scene: ReelScene;
  tokens: BrandTokens;
  innerHtml: string;
}): string {
  const { scene, tokens } = args;
  const pal = paletteFor(scene.mood);
  const accent = tokens.accent ?? pal.c;
  const speaker = speakerLabel(scene.visual);
  const textHtml = emphasize(scene.text, scene.emphasis).replace(/\n/g, "<br/>");
  const sid = scene.id;
  const tpl = scene.templateId || "hf-statement";
  const recipe = recipeForTemplate(tpl, scene.mood);
  const chip = chipHtml(speaker, accent, pal.ink);

  let body = "";
  switch (tpl) {
    case "hf-opener":
      body = `
        <div class="fx-dialogue fx-dlg-opener">
          <div class="fx-lt-plate" style="--accent:${accent}">
            ${chip}
            <div class="fx-stack opener-stack" style="color:${pal.ink}">${lineStackHtml(scene.text, scene.emphasis, 24, "fx-line sans", 5)}</div>
          </div>
        </div>`;
      break;
    case "hf-quote":
      body = `
        <div class="fx-dialogue fx-dlg-quote">
          ${chip}
          <div class="fx-qmark" style="color:${accent}">“</div>
          <div class="fx-stack quote-stack" style="color:${pal.ink}">${lineStackHtml(scene.text, scene.emphasis, 22, "fx-line serif", 5)}</div>
        </div>`;
      break;
    case "hf-statement":
      body = `
        <div class="fx-dialogue fx-dlg-statement">
          ${chip}
          <div class="fx-stack statement-stack" style="color:${pal.ink}">${lineStackHtml(scene.text, scene.emphasis, 12, "fx-line", 2)}</div>
          <div class="fx-rule" style="background:${accent}"></div>
        </div>`;
      break;
    case "hf-list": {
      const items = linesToItems(scene.text);
      body = `
        <div class="fx-dialogue fx-dlg-list">
          ${chip}
          <ul class="fx-check-list">
            ${items
              .map(
                (item, i) => `
              <li class="fx-check-item" style="--i:${i};color:${pal.ink}">
                <span class="fx-check-num" style="color:${accent}">${String(i + 1).padStart(2, "0")}</span>
                <span class="fx-check-text">${escapeHtml(item)}</span>
              </li>`,
              )
              .join("")}
          </ul>
        </div>`;
      break;
    }
    case "hf-stat": {
      const hasNum = /\d/.test(scene.visual || "");
      const countAttrs = hasNum
        ? ` data-count-to="${parseMoneyTargetLocal(scene.visual, scene.text)}" data-count-suffix="${/%/.test(scene.visual || "") ? "%" : /×|x/i.test(scene.visual || "") ? "×" : ""}"`
        : "";
      body = `
        <div class="fx-dialogue fx-dlg-stat">
          ${chip}
          <p class="fx-money-num"${countAttrs} style="color:${accent}">${escapeHtml(scene.visual || "—")}</p>
          <div class="fx-stack" style="color:${pal.ink}">${lineStackHtml(scene.text, scene.emphasis, 20, "fx-line sans")}</div>
        </div>`;
      break;
    }
    case "hf-cta":
      body = `
        <div class="fx-dialogue fx-dlg-cta">
          ${chip}
          <div class="fx-stack" style="color:${pal.ink}">${lineStackHtml(scene.text, scene.emphasis, 18)}</div>
          <div class="fx-cta-btn" style="background:${accent}">${escapeHtml(scene.visual || "Follow")}</div>
        </div>`;
      break;
    default:
      body = `
        <div class="fx-dialogue">
          ${chip}
          <div class="fx-stack" style="color:${pal.ink}">${lineStackHtml(scene.text || "", scene.emphasis, 18)}</div>
          ${!scene.text ? textHtml || args.innerHtml : ""}
        </div>`;
  }

  return `
    ${stageShell(sid, pal, recipe, "fx-classic")}
      <div class="fx-content recipe-content-${recipe}">
        ${body}
      </div>
    </div>`;
}

/** CSS for premium motion stages. */
export const NATIVE_CATALOG_STYLES = `
  .fx-stage {
    position: absolute; inset: 0; z-index: 2; overflow: hidden;
    color: var(--fx-ink, #fff);
    background: var(--fx-a, #07070c);
  }

  /* —— recipe: void-slash (kinetic hooks) —— */
  .recipe-void-slash .fx-void {
    position: absolute; inset: 0;
    background:
      radial-gradient(90% 60% at 80% 10%, color-mix(in oklab, var(--fx-c) 28%, transparent), transparent 55%),
      linear-gradient(160deg, var(--fx-a), var(--fx-b));
  }
  .fx-void-panel {
    position: absolute; left: -8%; top: -10%; bottom: -10%; width: 42%;
    background: linear-gradient(200deg, color-mix(in oklab, var(--fx-c) 55%, #000), transparent 75%);
    transform: skewX(-12deg) translateX(-40%);
    opacity: 0.9;
  }
  .fx-slash {
    position: absolute; left: -20%; top: 18%; width: 140%; height: 18%;
    background: linear-gradient(90deg, transparent, color-mix(in oklab, var(--fx-c) 85%, white 10%), transparent);
    transform: rotate(-18deg) scaleX(0);
    transform-origin: left center; opacity: 0.85; mix-blend-mode: screen;
  }
  .fx-slash-2 { top: 62%; height: 8%; opacity: 0.35; transform: rotate(-18deg) scaleX(0); }
  .fx-letterbox {
    position: absolute; left: 0; right: 0; height: 7%; background: #000; z-index: 6;
  }
  .fx-letterbox.top { top: 0; transform: scaleY(0); transform-origin: top; }
  .fx-letterbox.bot { bottom: 0; transform: scaleY(0); transform-origin: bottom; }

  /* —— recipe: editorial (quotes) —— */
  .recipe-editorial {
    background: #f3efe6;
    color: #16140f;
  }
  .recipe-editorial .fx-paper {
    position: absolute; inset: 0;
    background:
      radial-gradient(80% 50% at 20% 0%, rgba(255,255,255,0.7), transparent 60%),
      linear-gradient(180deg, #f7f3ea, #ebe4d6);
  }
  .recipe-editorial .fx-paper::after {
    content: "";
    position: absolute; inset: 6% 7%;
    border: 1px solid rgba(22,20,15,0.12);
    pointer-events: none;
  }
  .fx-paper-rule {
    position: absolute; left: 10%; right: 10%; top: 14%; height: 1px;
    background: rgba(22,20,15,0.18); transform: scaleX(0); transform-origin: left;
  }
  .fx-paper-corner {
    position: absolute; right: 8%; bottom: 10%; width: 120px; height: 120px;
    border-right: 2px solid rgba(22,20,15,0.2); border-bottom: 2px solid rgba(22,20,15,0.2);
    opacity: 0; transform: translate(12px, 12px);
  }
  .recipe-editorial .fx-chip {
    color: #16140f !important; border-color: rgba(22,20,15,0.35);
    background: rgba(22,20,15,0.06);
  }
  .recipe-editorial .fx-stack, .recipe-editorial .quote-stack { color: #16140f !important; }
  .recipe-editorial .em { color: #9a3412; box-shadow: inset 0 -0.18em 0 0 rgba(154,52,18,0.25); }
  .recipe-editorial .fx-qmark { color: #c2410c !important; opacity: 0.9; }

  /* —— recipe: lower-third (opener / host) —— */
  .recipe-lower-third .fx-studio {
    position: absolute; inset: 0;
    background:
      radial-gradient(70% 40% at 50% 0%, color-mix(in oklab, var(--fx-c) 22%, transparent), transparent 70%),
      linear-gradient(180deg, #070b14 0%, #0c1524 45%, #05070d 100%);
  }
  .fx-studio-beam {
    position: absolute; left: 50%; top: -10%; width: 70%; height: 55%;
    margin-left: -35%;
    background: radial-gradient(ellipse at center, color-mix(in oklab, var(--fx-glow) 35%, transparent), transparent 70%);
    opacity: 0; transform: scale(0.8);
  }
  .fx-floor-glow {
    position: absolute; left: 10%; right: 10%; bottom: 12%; height: 30%;
    background: radial-gradient(ellipse at center, color-mix(in oklab, var(--fx-c) 30%, transparent), transparent 70%);
    opacity: 0;
  }
  .fx-lt-plate {
    width: 100%; max-width: 920px; text-align: left;
    padding: 28px 32px; border-radius: 4px 28px 28px 4px;
    background: linear-gradient(90deg, rgba(8,12,22,0.92), rgba(8,12,22,0.55));
    border-left: 6px solid var(--accent, var(--fx-c));
    backdrop-filter: blur(16px);
    opacity: 0; transform: translateX(-48px);
  }

  /* —— recipe: punch-block (dramatic statements) —— */
  .recipe-punch-block .fx-block-a {
    position: absolute; inset: 0;
    background: var(--fx-a);
  }
  .recipe-punch-block .fx-block-b {
    position: absolute; left: 0; top: 0; bottom: 0; width: 100%;
    background: var(--fx-c);
    transform: scaleX(0); transform-origin: left;
  }
  .fx-block-flash {
    position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none;
  }
  .recipe-punch-block .statement-stack { color: #fff !important; mix-blend-mode: normal; }

  /* —— recipe: terminal (tech questions) —— */
  .recipe-terminal .fx-term-bg {
    position: absolute; inset: 0;
    background: linear-gradient(180deg, #031018, #02080f 60%, #000);
  }
  .fx-term-grid {
    position: absolute; inset: 0; opacity: 0;
    background-image:
      linear-gradient(rgba(34,211,238,0.12) 1px, transparent 1px),
      linear-gradient(90deg, rgba(34,211,238,0.12) 1px, transparent 1px);
    background-size: 56px 56px;
    mask-image: radial-gradient(circle at 50% 40%, black 10%, transparent 75%);
  }
  .fx-term-scan {
    position: absolute; left: 0; right: 0; height: 22%; top: 0;
    background: linear-gradient(180deg, transparent, rgba(34,211,238,0.18), transparent);
    opacity: 0;
  }
  .recipe-terminal .slam-stack, .recipe-terminal .fx-stack {
    font-family: "DM Sans", ui-monospace, monospace; letter-spacing: 0.04em;
  }
  .recipe-terminal .fx-kicker::before { content: "> "; }

  /* —— recipe: stack-cards (lists) —— */
  .recipe-stack-cards .fx-deep {
    position: absolute; inset: 0;
    background:
      radial-gradient(80% 50% at 50% 100%, color-mix(in oklab, var(--fx-c) 22%, transparent), transparent 55%),
      linear-gradient(180deg, var(--fx-a), var(--fx-b));
  }
  .fx-deep-orb {
    position: absolute; width: 80cqw; height: 80cqw; left: 10%; top: -20%;
    border-radius: 50%;
    background: radial-gradient(circle, color-mix(in oklab, var(--fx-glow) 30%, transparent), transparent 70%);
    opacity: 0;
  }

  /* —— recipe: billboard —— */
  .recipe-billboard .fx-bill-bg {
    position: absolute; inset: 0;
    background:
      linear-gradient(145deg, var(--fx-b), var(--fx-a) 55%, color-mix(in oklab, var(--fx-c) 25%, var(--fx-a)));
  }
  .fx-bill-shine {
    position: absolute; inset: -20%;
    background: conic-gradient(from 200deg at 30% 20%, transparent, color-mix(in oklab, var(--fx-glow) 40%, transparent), transparent 40%);
    opacity: 0;
  }

  /* —— recipe: minimal-mark (outro) —— */
  .recipe-minimal-mark .fx-min-bg {
    position: absolute; inset: 0;
    background: radial-gradient(70% 50% at 50% 45%, #14141c, #050508);
  }
  .fx-min-ring {
    position: absolute; left: 50%; top: 38%; width: 54cqw; height: 54cqw;
    margin: -27cqw 0 0 -27cqw; border-radius: 50%;
    border: 1px solid color-mix(in oklab, var(--fx-c) 40%, transparent);
    opacity: 0; transform: scale(0.7);
  }

  /* —— recipe: social-plate —— */
  .recipe-social-plate .fx-social-bg {
    position: absolute; inset: 0;
    background:
      radial-gradient(90% 60% at 50% 100%, color-mix(in oklab, var(--fx-c) 35%, transparent), transparent 55%),
      linear-gradient(180deg, var(--fx-a), var(--fx-b));
  }
  .fx-social-blob {
    position: absolute; width: 70cqw; height: 70cqw; right: -20%; top: 10%;
    border-radius: 40% 60% 55% 45%;
    background: radial-gradient(circle at 30% 30%, color-mix(in oklab, var(--fx-glow) 45%, transparent), transparent 70%);
    opacity: 0; filter: blur(4px);
  }

  .fx-grain {
    position: absolute; inset: 0; opacity: 0.16; mix-blend-mode: overlay; pointer-events: none; z-index: 4;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }
  .fx-grain.soft { opacity: 0.08; }

  /* —— content + type (line-clipped — no overlapping words) —— */
  .fx-content {
    position: absolute; inset: 0; z-index: 5;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 14% 9%; text-align: center;
  }
  .fx-content-end { justify-content: flex-end; padding-bottom: 16%; gap: 28px; }
  .fx-content-slam { padding: 16% 8%; }
  .recipe-content-lower-third { justify-content: flex-end; padding-bottom: 18%; align-items: stretch; }
  .recipe-content-editorial { align-items: flex-start; text-align: left; padding: 18% 10%; }

  .fx-kicker {
    font-size: 18px; font-weight: 800; letter-spacing: 0.36em; margin-bottom: 22px;
    opacity: 0; transform: translateY(10px);
  }

  .fx-stack {
    display: flex; flex-direction: column; align-items: center; gap: 0.22em;
    width: 100%; max-width: 96%;
  }
  .slam-stack { max-width: 96%; gap: 0.16em; }
  .recipe-content-editorial .fx-stack,
  .quote-stack { align-items: flex-start; max-width: 92%; gap: 0.42em; }
  .opener-stack { align-items: flex-start; max-width: 100%; gap: 0.2em; }
  .social-stack { max-width: 92%; }
  .statement-stack { gap: 0.2em; }

  .fx-line {
    display: block; overflow: hidden; width: auto; max-width: 100%;
    line-height: 1.2; padding: 0.06em 0;
  }
  .fx-line-inner {
    display: block;
    transform: translateY(110%);
    will-change: transform;
    white-space: nowrap;
    line-height: 1.2;
  }
  .slam-stack .fx-line {
    font-family: "Anton", Impact, sans-serif; font-weight: 400;
    font-size: clamp(42px, 7.6cqw, 78px);
    text-transform: uppercase; letter-spacing: 0.02em;
    line-height: 1.12;
  }
  .slam-stack .fx-line-inner { line-height: 1.12; }
  .fx-line.sans .fx-line-inner,
  .opener-stack .fx-line-inner,
  .statement-stack .fx-line-inner {
    font-family: "DM Sans", system-ui, sans-serif; font-weight: 800;
    font-size: clamp(30px, 4.8cqw, 56px); letter-spacing: -0.03em;
    text-transform: none;
  }
  .statement-stack .fx-line {
    font-family: "DM Sans", system-ui, sans-serif; font-weight: 800;
    font-size: clamp(32px, 5.2cqw, 60px); letter-spacing: -0.03em;
  }
  .recipe-punch-block .statement-stack .fx-line,
  .recipe-punch-block .statement-stack .fx-line-inner {
    font-size: clamp(36px, 6cqw, 68px);
  }
  .fx-content { z-index: 8; }
  .recipe-punch-block .fx-block-a,
  .recipe-punch-block .fx-block-b,
  .fx-block-flash { z-index: 1; }
  .fx-line.serif .fx-line-inner,
  .quote-stack .fx-line-inner,
  .outro-stack .fx-line-inner {
    font-family: "Instrument Serif", Georgia, serif; font-style: italic; font-weight: 400;
    font-size: clamp(36px, 5.2cqw, 62px); letter-spacing: -0.01em;
    text-transform: none;
    padding-right: 0.08em; /* italic overhang */
  }
  .em {
    color: var(--fx-c); font-style: inherit;
    text-decoration: underline;
    text-decoration-thickness: 0.12em;
    text-underline-offset: 0.12em;
    box-shadow: none;
  }
  .recipe-editorial .em {
    color: #9a3412;
    text-decoration-color: rgba(154,52,18,0.45);
  }
  .recipe-punch-block .em {
    color: #fff;
    text-decoration-color: rgba(255,255,255,0.85);
  }

  .fx-rule {
    width: 96px; height: 5px; border-radius: 999px; margin-top: 28px;
    transform: scaleX(0); transform-origin: center;
  }
  .fx-chip {
    display: inline-flex; align-items: center;
    font-size: 15px; font-weight: 800; letter-spacing: 0.22em;
    text-transform: uppercase; margin-bottom: 18px;
    border: 1px solid var(--chip, var(--fx-c)); border-radius: 999px;
    padding: 8px 14px;
    background: color-mix(in oklab, var(--chip, var(--fx-c)) 14%, transparent);
    opacity: 0; transform: translateY(8px);
  }
  .fx-qmark {
    font-family: "Instrument Serif", Georgia, serif;
    font-size: clamp(88px, 14cqw, 150px); line-height: 0.7; margin-bottom: 6px;
    opacity: 0; transform: translateY(16px);
  }
  .fx-check-list { list-style: none; display: grid; gap: 16px; width: min(920px, 96%); text-align: left; }
  .fx-check-item {
    display: flex; gap: 18px; align-items: flex-start;
    font-size: clamp(26px, 3.8cqw, 40px); font-weight: 700; line-height: 1.25;
    padding: 18px 20px; border-radius: 18px;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
    opacity: 0; transform: translateY(28px);
  }
  .fx-check-num {
    flex: 0 0 auto; font-family: "Anton", Impact, sans-serif;
    font-size: 0.9em; letter-spacing: 0.04em; line-height: 1.2;
  }
  .fx-logo-mark {
    width: 112px; height: 112px; border-radius: 28px; border: 2px solid;
    display: grid; place-items: center; font-size: 52px; font-weight: 800;
    background: rgba(255,255,255,0.04); margin-bottom: 26px;
    opacity: 0; transform: scale(0.85);
  }
  .fx-pill {
    margin-top: 22px; font-size: 20px; font-weight: 700; opacity: 0;
    padding: 10px 18px; border-radius: 999px; background: rgba(255,255,255,0.08);
  }
  .fx-social-card, .fx-yt-bar {
    display: flex; align-items: center; gap: 16px; width: min(880px, 94%);
    background: rgba(8,8,12,0.82); border: 1px solid rgba(255,255,255,0.14);
    border-radius: 28px; padding: 18px 20px; backdrop-filter: blur(18px);
    opacity: 0; transform: translateY(40px);
  }
  .fx-avatar {
    width: 64px; height: 64px; border-radius: 20px;
    display: grid; place-items: center; font-weight: 800; font-size: 26px; color: #0b0f19;
  }
  .fx-avatar.round { border-radius: 50%; }
  .fx-social-name, .fx-yt-name { font-size: 26px; font-weight: 800; text-align: left; }
  .fx-social-net, .fx-yt-sub { font-size: 16px; opacity: 0.7; text-align: left; }
  .fx-social-btn, .fx-yt-btn, .fx-cta-btn {
    margin-left: auto; padding: 12px 22px; border-radius: 999px;
    font-weight: 800; color: #0b0f19; font-size: 18px;
  }
  .fx-cta-btn {
    margin: 28px auto 0; display: inline-block; opacity: 0; transform: translateY(14px);
  }
  .fx-yt-btn { background: #f00; color: #fff; }
  .fx-money-num {
    font-size: clamp(88px, 16cqw, 168px); font-weight: 800; letter-spacing: -0.05em;
    line-height: 0.95; opacity: 0; transform: translateY(24px);
  }
  .fx-money-line, .fx-chart-line {
    font-size: clamp(26px, 3.8cqw, 40px); font-weight: 700; max-width: 18ch;
    opacity: 0; transform: translateY(14px);
  }
  .fx-chart-title {
    font-family: "Instrument Serif", Georgia, serif; font-size: 36px; margin-bottom: 18px;
    opacity: 0; transform: translateY(10px);
  }
  .fx-chart-bars {
    display: flex; align-items: flex-end; gap: 14px; height: 260px; width: min(720px, 86%);
    margin-bottom: 20px;
  }
  .fx-chart-bars i {
    flex: 1; height: var(--h); border-radius: 10px 10px 4px 4px; display: block;
    background: linear-gradient(180deg, var(--fx-c), #333);
    transform: scaleY(0.08); transform-origin: bottom;
  }
  .fx-phone {
    width: 250px; height: 500px; border-radius: 34px; padding: 12px; margin-bottom: 26px;
    background: linear-gradient(160deg, #444, #111); box-shadow: 0 36px 80px rgba(0,0,0,0.5);
    opacity: 0; transform: translateY(28px);
  }
  .fx-phone-screen {
    position: relative; width: 100%; height: 100%; border-radius: 26px; overflow: hidden;
    background: linear-gradient(180deg, #152038, #0b0f19);
    display: grid; place-items: end center; padding: 28px;
  }
  .fx-phone-shine {
    position: absolute; inset: -40% auto auto -30%; width: 70%; height: 70%;
    background: linear-gradient(120deg, rgba(255,255,255,0.25), transparent 60%);
    transform: rotate(18deg);
  }
  .fx-phone-cta { padding: 14px 22px; border-radius: 999px; font-weight: 800; color: #0b0f19; }
  .fx-dialogue { position: relative; width: 100%; max-width: 96%; }
  .fx-dlg-quote { text-align: left; }
  .fx-dlg-list { text-align: left; }
  .fx-dlg-opener { width: 100%; display: flex; justify-content: stretch; }
`;

/**
 * GSAP boot: line-reveal timelines (no mid-word translate collisions).
 */
export function buildGsapMotionBootScript(): string {
  return `
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<script>
(function () {
  function revealFallback() {
    document.querySelectorAll('.fx-line-inner, .fx-kicker, .fx-rule, .fx-logo-mark, .fx-pill, .fx-social-card, .fx-yt-bar, .fx-money-num, .fx-money-line, .fx-chart-line, .fx-chart-title, .fx-phone, .fx-chip, .fx-qmark, .fx-check-item, .fx-cta-btn, .fx-lt-plate, .fx-slash, .fx-letterbox, .fx-term-grid, .fx-chart-bars i').forEach(function (el) {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
  }
  function boot() {
    if (!window.gsap) { revealFallback(); return; }
    window.__timelines = window.__timelines || {};
    document.querySelectorAll('[data-motion-scene]').forEach(function (stage) {
      var id = stage.getAttribute('data-motion-scene');
      if (!id) return;
      var recipe = stage.getAttribute('data-recipe') || '';
      var tl = gsap.timeline({ paused: true });

      var lines = stage.querySelectorAll('.fx-line-inner');
      var kicker = stage.querySelector('.fx-kicker');
      var rule = stage.querySelector('.fx-rule');
      var chip = stage.querySelector('.fx-chip');
      var qmark = stage.querySelector('.fx-qmark');
      var plate = stage.querySelector('.fx-lt-plate');
      var checks = stage.querySelectorAll('.fx-check-item');
      var logo = stage.querySelector('.fx-logo-mark');
      var pill = stage.querySelector('.fx-pill');
      var card = stage.querySelector('.fx-social-card, .fx-yt-bar');
      var money = stage.querySelector('.fx-money-num');
      var moneyLine = stage.querySelector('.fx-money-line, .fx-chart-line');
      var chartTitle = stage.querySelector('.fx-chart-title');
      var bars = stage.querySelectorAll('.fx-chart-bars i');
      var phone = stage.querySelector('.fx-phone');
      var cta = stage.querySelector('.fx-cta-btn');
      var slash = stage.querySelectorAll('.fx-slash');
      var letterbox = stage.querySelectorAll('.fx-letterbox');
      var blockB = stage.querySelector('.fx-block-b');
      var flash = stage.querySelector('.fx-block-flash');
      var grid = stage.querySelector('.fx-term-grid');
      var scan = stage.querySelector('.fx-term-scan');
      var beam = stage.querySelector('.fx-studio-beam');
      var floor = stage.querySelector('.fx-floor-glow');
      var paperRule = stage.querySelector('.fx-paper-rule');
      var corner = stage.querySelector('.fx-paper-corner');
      var ring = stage.querySelector('.fx-min-ring');
      var blob = stage.querySelector('.fx-social-blob');
      var shine = stage.querySelector('.fx-bill-shine');
      var deepOrb = stage.querySelector('.fx-deep-orb');

      // Recipe-specific backgrounds
      if (recipe === 'void-slash') {
        letterbox.forEach(function (el) { tl.to(el, { scaleY: 1, duration: 0.35, ease: 'power3.out' }, 0); });
        var panel = stage.querySelector('.fx-void-panel');
        if (panel) tl.fromTo(panel, { xPercent: -55 }, { xPercent: -8, duration: 0.75, ease: 'power3.out' }, 0);
        slash.forEach(function (el, i) {
          tl.to(el, { scaleX: 1, duration: 0.55, ease: 'power4.out' }, 0.08 + i * 0.12);
          tl.to(el, { opacity: i ? 0.25 : 0.55, duration: 0.6 }, 0.7);
        });
      }
      if (recipe === 'editorial') {
        if (paperRule) tl.to(paperRule, { scaleX: 1, duration: 0.5, ease: 'power2.out' }, 0.05);
        if (corner) tl.to(corner, { opacity: 1, x: 0, y: 0, duration: 0.55, ease: 'power2.out' }, 0.2);
      }
      if (recipe === 'lower-third') {
        if (beam) tl.to(beam, { opacity: 1, scale: 1, duration: 0.8, ease: 'power2.out' }, 0);
        if (floor) tl.to(floor, { opacity: 1, duration: 0.7 }, 0.1);
        letterbox.forEach(function (el) { tl.to(el, { scaleY: 1, duration: 0.3, ease: 'power2.out' }, 0); });
        if (plate) tl.to(plate, { opacity: 1, x: 0, duration: 0.55, ease: 'power3.out' }, 0.15);
      }
      if (recipe === 'punch-block') {
        if (blockB) tl.to(blockB, { scaleX: 1, duration: 0.45, ease: 'power4.inOut' }, 0);
        if (flash) {
          tl.to(flash, { opacity: 0.55, duration: 0.08 }, 0.4);
          tl.to(flash, { opacity: 0, duration: 0.25 }, 0.5);
        }
      }
      if (recipe === 'terminal') {
        if (grid) tl.to(grid, { opacity: 0.7, duration: 0.5 }, 0);
        if (scan) tl.fromTo(scan, { y: '-30%', opacity: 0 }, { y: '140%', opacity: 0.7, duration: 1.4, ease: 'none' }, 0.1);
      }
      if (recipe === 'stack-cards' && deepOrb) tl.to(deepOrb, { opacity: 1, duration: 0.8 }, 0);
      if (recipe === 'billboard' && shine) tl.to(shine, { opacity: 0.7, duration: 0.9, ease: 'power2.out' }, 0);
      if (recipe === 'minimal-mark' && ring) tl.to(ring, { opacity: 0.5, scale: 1, duration: 0.8, ease: 'power2.out' }, 0.1);
      if (recipe === 'social-plate' && blob) tl.to(blob, { opacity: 0.8, duration: 0.7 }, 0);

      if (chip) tl.to(chip, { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out' }, 0.12);
      if (qmark) tl.to(qmark, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }, 0.15);
      if (kicker) tl.to(kicker, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }, 0.1);

      // Line reveals — clipped, never overlapping
      lines.forEach(function (inner, i) {
        tl.to(inner, { y: '0%', duration: 0.42, ease: 'power3.out' }, 0.22 + i * 0.1);
      });

      if (rule) tl.to(rule, { scaleX: 1, duration: 0.4, ease: 'power3.out' }, Math.max(0.55, 0.22 + lines.length * 0.1));
      checks.forEach(function (item, i) {
        tl.to(item, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }, 0.25 + i * 0.16);
      });
      if (logo) tl.to(logo, { opacity: 1, scale: 1, duration: 0.55, ease: 'back.out(1.5)' }, 0.15);
      if (pill) tl.to(pill, { opacity: 1, duration: 0.35 }, 0.7);
      if (card) tl.to(card, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 0.4);
      if (money) {
        tl.fromTo(money, { opacity: 0, y: 36, scale: 0.86 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'back.out(1.6)' }, 0.12);
        var countTo = Number(money.getAttribute('data-count-to') || '0');
        var countSuffix = money.getAttribute('data-count-suffix') || '';
        if (countTo > 0 && countTo <= 1000000) {
          var counter = { v: 0 };
          tl.to(counter, {
            v: countTo,
            duration: 0.9,
            ease: 'power2.out',
            onUpdate: function () {
              var n = Math.round(counter.v);
              money.textContent = countSuffix === '%' ? (n + '%')
                : countSuffix === '×' ? (n + '×')
                : String(n);
            }
          }, 0.18);
        }
      }
      if (moneyLine) tl.to(moneyLine, { opacity: 1, y: 0, duration: 0.4 }, 0.5);
      if (chartTitle) tl.to(chartTitle, { opacity: 1, y: 0, duration: 0.35 }, 0.1);
      bars.forEach(function (b, i) {
        tl.to(b, { scaleY: 1, duration: 0.5, ease: 'power3.out' }, 0.25 + i * 0.07);
      });
      if (phone) tl.to(phone, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 0.1);
      if (cta) tl.to(cta, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }, 0.5);

      // Ambient life after the entrance so long VO doesn't freeze into a poster.
      var holdEnd = Math.max(tl.duration(), 1.35);
      if (scan) {
        tl.to(scan, { y: '160%', opacity: 0.55, duration: 2.4, ease: 'none', repeat: 2 }, holdEnd * 0.15);
      }
      if (deepOrb) {
        tl.to(deepOrb, { scale: 1.08, duration: 2.2, yoyo: true, repeat: 2, ease: 'sine.inOut' }, holdEnd * 0.2);
      }
      slash.forEach(function (el, i) {
        tl.to(el, { x: i ? 24 : -18, duration: 2.6, yoyo: true, repeat: 1, ease: 'sine.inOut' }, holdEnd * 0.25);
      });
      if (beam) {
        tl.to(beam, { opacity: 0.85, scale: 1.05, duration: 1.8, yoyo: true, repeat: 2, ease: 'sine.inOut' }, holdEnd * 0.2);
      }
      if (shine) {
        tl.to(shine, { x: '18%', duration: 2.4, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0.4);
      }

      if (tl.duration() < 1.35) tl.to({}, { duration: 1.35 }, 0);
      tl.seek(Math.min(tl.duration(), 1.1));
      window.__timelines[id] = tl;
    });
  }
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);
  setTimeout(function () { if (!window.gsap) revealFallback(); }, 2500);
})();
</script>`;
}
