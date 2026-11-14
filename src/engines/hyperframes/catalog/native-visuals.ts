import { PRODUCTION_SCENE_ROLES } from "@/production/roles";
import { MULTI_SERIES_TIMELINE_BOOT } from "../motion/multi-series-scene";
import { ADAPTIVE_BOOT } from "../motion/adaptive-blocks";
import { SEQUENCE_HANDOFF_BOOT } from "../motion/sequence-handoff";
import { DESIGN_MOTION_BOOT } from "../motion/design-blocks";
import { SHOWPIECE_BOOT } from "../motion/showpiece-blocks";
import { CELESTIAL_BOOT } from "../motion/celestial-blocks";
import { SEMANTIC_GRAPHIC_BOOT } from "../motion/semantic-blocks";
import { escapeHtml } from "@/lib/html";
import { iconForScene, iconSvg } from "@/engines/hyperframes/assets/icons";
import { sceneDefinitionForTemplate } from "@/engines/hyperframes/scenes/registry";
import {
  CHART_STYLES,
  SCENE_STYLES,
} from "@/engines/hyperframes/scenes/styles";
import { MOTION_LIBRARY_TIMING } from "@/video/motion-library";
import { STORY_MOTION_TRACKS } from "@/production/story-motion";
import { GRAPH_TIMELINE_BOOT } from "../motion/compile-shot";
import { GSAP_PREVIEW_URL } from "@/engines/hyperframes/runtime";
import { TYPE_MOTIF_OFFSETS } from "@/production/motion";
import { MOTION_EVENT_TIMINGS } from "@/production/motion-events";
import type { BrandTokens } from "@/video/tokens";
import type { ReelScene, SceneMood } from "@/video/types";
import type { HfCatalogBlockMeta } from "@/engines/hyperframes/catalog/manifest";

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

const UNIT =
  /^(?:%|x|k|m|b|mb|gb|kb|kg|km|mph|ms|seconds?|minutes?|hours?|days?|weeks?|months?|years?|times|percent|per)$/i;

/** Words that must stay on one line: a number with its unit, and short emphasis phrases. */
function glueLinks(words: string[], emphasis: string[]): boolean[] {
  // glue[i] true means word i stays with word i + 1.
  const glue = words.map(() => false);
  for (let i = 0; i < words.length - 1; i++) {
    if (
      /\d/.test(words[i]!) &&
      UNIT.test(words[i + 1]!.replace(/[.,;:!?]+$/, ""))
    )
      glue[i] = true;
  }
  for (const phrase of emphasis) {
    const parts = phrase.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2 || parts.length > 3) continue;
    const norm = (w: string) =>
      w.toLowerCase().replace(/[^\p{L}\p{N}%$]/gu, "");
    for (let i = 0; i + parts.length <= words.length; i++) {
      if (parts.every((part, k) => norm(words[i + k]!) === norm(part))) {
        for (let k = 0; k < parts.length - 1; k++) glue[i + k] = true;
      }
    }
  }
  return glue;
}

/**
 * Pack copy into short display lines so type never wraps mid-animation.
 * The line count is the greedy minimum; the words are then spread to make
 * the lines as even as possible, so the last line is never a lone word when
 * the copy has four words or more. A number stays with its unit and a short
 * emphasized phrase stays together.
 */
function packLinesWithin(
  text: string,
  maxChars: number,
  maxWordsPerLine: number,
  emphasis: string[],
): string[] {
  const words = text.replace(/\n+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const glue = glueLinks(words, emphasis);
  const tokens: string[][] = [];
  for (let i = 0; i < words.length; i++) {
    if (i > 0 && glue[i - 1]) tokens[tokens.length - 1]!.push(words[i]!);
    else tokens.push([words[i]!]);
  }
  const lenOf = (from: number, to: number) =>
    tokens
      .slice(from, to)
      .reduce((n, t, k) => n + t.join(" ").length + (k > 0 ? 1 : 0), 0);
  const wordsOf = (from: number, to: number) =>
    tokens.slice(from, to).reduce((n, t) => n + t.length, 0);
  const allowed = (from: number, to: number) =>
    to - from === 1 ||
    (lenOf(from, to) <= maxChars && wordsOf(from, to) <= maxWordsPerLine);

  // Greedy minimum number of lines.
  let count = 1;
  let start = 0;
  for (let end = 1; end <= tokens.length; end++) {
    if (!allowed(start, end)) {
      count += 1;
      start = end - 1;
    }
  }
  const render = (from: number, to: number) =>
    tokens
      .slice(from, to)
      .map((t) => t.join(" "))
      .join(" ");
  if (count === 1) return [render(0, tokens.length)];

  // Even out exactly `count` lines: minimise squared distance from the mean
  // length, with a heavy penalty for a one-word line in longer copy.
  const total = lenOf(0, tokens.length);
  const target = total / count;
  const n = tokens.length;
  const best: number[][] = Array.from({ length: count + 1 }, () =>
    Array<number>(n + 1).fill(Infinity),
  );
  const cut: number[][] = Array.from({ length: count + 1 }, () =>
    Array<number>(n + 1).fill(0),
  );
  best[0]![0] = 0;
  for (let k = 1; k <= count; k++) {
    for (let end = k; end <= n; end++) {
      for (let from = k - 1; from < end; from++) {
        if (best[k - 1]![from] === Infinity || !allowed(from, end)) continue;
        const len = lenOf(from, end);
        const lone =
          wordsOf(from, end) === 1 && words.length >= 4
            ? end === n
              ? 400
              : 40
            : 0;
        const cost = best[k - 1]![from]! + (target - len) ** 2 + lone;
        if (cost < best[k]![end]!) {
          best[k]![end] = cost;
          cut[k]![end] = from;
        }
      }
    }
  }
  if (best[count]![n] === Infinity) {
    // Cannot happen for a greedy-feasible count; keep the greedy result.
    const lines: string[] = [];
    let from = 0;
    for (let end = 1; end <= n; end++) {
      if (!allowed(from, end)) {
        lines.push(render(from, end - 1));
        from = end - 1;
      }
    }
    lines.push(render(from, n));
    return lines;
  }
  const lines: string[] = [];
  let end = n;
  for (let k = count; k >= 1; k--) {
    const from = cut[k]![end]!;
    lines.unshift(render(from, end));
    end = from;
  }
  return lines;
}

export function packLines(
  text: string,
  maxChars = 18,
  maxWordsPerLine = 99,
  emphasis: string[] = [],
): string[] {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  let lines: string[] = [];
  // If the strict limits leave a lone last word, relax them a little: the
  // runtime fit then shrinks the type if the wider line needs it.
  for (const [chars, words] of [
    [maxChars, maxWordsPerLine],
    [Math.ceil(maxChars * 1.35), maxWordsPerLine + 1],
    [Math.ceil(maxChars * 1.8), maxWordsPerLine + 1],
  ] as const) {
    lines = packLinesWithin(text, chars, words, emphasis);
    const last = lines.at(-1)?.split(/\s+/).length ?? 0;
    if (lines.length < 2 || wordCount < 4 || last >= 2) break;
  }
  return lines;
}

function lineStackHtml(
  text: string,
  emphasis: string[],
  maxChars = 18,
  lineClass = "fx-line",
  maxWordsPerLine = 99,
): string {
  return packLines(text, maxChars, maxWordsPerLine, emphasis)
    .map(
      (line, i) =>
        `<div class="${lineClass}" data-li="${i}"><span class="fx-line-inner" data-layout-allow-overflow>${emphasize(line, emphasis)}</span></div>`,
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

function paletteFor(mood: SceneMood | undefined, tokens: BrandTokens): Palette {
  const moodPalette = (mood && MOOD_PALETTES[mood]) || MOOD_PALETTES.default;
  return {
    ...moodPalette,
    a: tokens.background ?? moodPalette.a,
    b: tokens.backgroundAccent ?? moodPalette.b,
    c: tokens.accent ?? moodPalette.c,
    glow: tokens.accentSecondary ?? moodPalette.glow,
    ink: tokens.foreground ?? moodPalette.ink,
    muted: tokens.muted ?? moodPalette.muted,
  };
}

/** Parse a count-up target from visual/text (90%, 10x, $10k). */
function parseMoneyTargetLocal(visual: string | undefined): number | null {
  const m = visual?.match(
    /\$?\s*([\d]{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*([kKmMbB])?/,
  );
  if (!m) return null;
  let n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  const suffix = (m[2] ?? "").toLowerCase();
  if (suffix === "k") n *= 1_000;
  if (suffix === "m") n *= 1_000_000;
  if (suffix === "b") n *= 1_000_000_000;
  return Math.max(0, Math.round(n));
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
        <div class="fx-studio-beam" data-layout-allow-overflow aria-hidden="true"></div>
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
        <div class="fx-deep-orb" data-layout-allow-overflow aria-hidden="true"></div>
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
        <div class="fx-social-blob" data-layout-allow-overflow aria-hidden="true"></div>
        <div class="fx-grain"></div>`;

    default:
      return `<div ${common}>
        <div class="fx-void"></div>
        <div class="fx-grain"></div>`;
  }
}

/** Bars come pre-rendered; line and donut are drawn here from the same values. */
function chartVariantHtml(args: {
  kind: "bar" | "line" | "donut";
  labels: string[];
  values: number[];
  unit: string;
  accent: string;
  ink: string;
  barsHtml: string;
}): string {
  const { kind, labels, values, unit, accent, ink } = args;
  if (kind === "line" && values.length >= 2) {
    const W = 600;
    const H = 300;
    const padX = 50;
    const top = 50;
    const bottom = 250;
    const min = Math.min(0, ...values);
    const max = Math.max(1, ...values);
    const x = (i: number) =>
      padX + (i * (W - 2 * padX)) / Math.max(1, values.length - 1);
    const y = (v: number) =>
      bottom - ((v - min) / Math.max(1e-9, max - min)) * (bottom - top);
    const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    return `<svg class="fx-chart-svg fx-rv" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="color:${ink}" role="img" aria-label="${escapeHtml(labels.map((l, i) => `${l}: ${values[i]}${unit}`).join(", "))}">
      <line x1="${padX - 20}" y1="${bottom}" x2="${W - padX + 20}" y2="${bottom}" stroke="currentColor" stroke-opacity=".3" stroke-width="2"/>
      <polyline points="${pts.join(" ")}" fill="none" stroke="${accent}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>
      ${values
        .map(
          (
            v,
            i,
          ) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="10" fill="${accent}"/>
      <text x="${x(i).toFixed(1)}" y="${(y(v) - 22).toFixed(1)}" font-size="30" text-anchor="middle">${escapeHtml(`${v}${unit}`)}</text>
      <text x="${x(i).toFixed(1)}" y="${bottom + 38}" font-size="28" text-anchor="middle" fill-opacity=".85">${escapeHtml(labels[i] ?? "")}</text>`,
        )
        .join("")}
    </svg>`;
  }
  if (kind === "donut") {
    const positive = values.map((v) => Math.max(0, v));
    const total = positive.reduce((a, b) => a + b, 0);
    if (total > 0) {
      const R = 100;
      const C = 2 * Math.PI * R;
      let offset = 0;
      const ramp = [1, 0.78, 0.58, 0.42, 0.3, 0.2];
      const arcs = positive.map((v, i) => {
        const len = (v / total) * C;
        const arc = `<circle cx="150" cy="150" r="${R}" fill="none" stroke="${accent}" stroke-opacity="${ramp[i % ramp.length]}" stroke-width="56" stroke-dasharray="${Math.max(0, len - 3).toFixed(2)} ${(C - Math.max(0, len - 3)).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 150 150)"/>`;
        offset += len;
        return arc;
      });
      const legend = positive.map(
        (v, i) =>
          `<li style="color:${ink}"><i style="background:${accent};opacity:${ramp[i % ramp.length]}"></i>${escapeHtml(labels[i] ?? "")} · ${escapeHtml(`${values[i]}${unit}`)}</li>`,
      );
      return `<div class="fx-donut fx-rv"><svg viewBox="0 0 300 300" role="img" aria-label="${escapeHtml(labels.map((l, i) => `${l}: ${values[i]}${unit}`).join(", "))}">${arcs.join("")}</svg><ul class="fx-donut-legend">${legend.join("")}</ul></div>`;
    }
  }
  return `<div class="fx-chart-bars">${args.barsHtml}</div>`;
}

function recipeForTemplate(templateId: string, mood?: SceneMood): string {
  const registered = sceneDefinitionForTemplate(templateId);
  if (registered) return registered.recipe;
  switch (templateId) {
    case "hf-kinetic-slam":
    case "caption-kinetic-slam":
      return mood === "tech" ? "terminal" : "void-slash";
    case "hf-quote":
      return "editorial";
    case "hf-opener":
    case "hf-broll":
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

/** Dark or white text, whichever reads better on the accent (WCAG luminance). */
function onAccentColor(accent: string): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(accent.trim());
  if (!m) return "#0b0b12";
  const hex =
    m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join("") : m[1]!;
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  // Whichever of dark and white has the higher contrast ratio against it.
  return (luminance + 0.05) / 0.054 >= 1.05 / (luminance + 0.05)
    ? "#0b0b12"
    : "#ffffff";
}

/** Decorative shapes drawn behind the content; the theme decides whether and how they show. */
const DECO_HTML = `<div class="fx-deco" aria-hidden="true"><i></i><i></i><i></i></div>`;

function chipHtml(speaker: string, accent: string, ink: string): string {
  // Scene roles are internal vocabulary ("summary", "cta"); never put them on screen.
  if (
    !speaker ||
    (PRODUCTION_SCENE_ROLES as readonly string[]).includes(
      speaker.trim().toLowerCase(),
    )
  )
    return "";
  return `<p class="fx-chip" style="--chip:${accent};color:${ink}">${escapeHtml(speaker)}</p>`;
}

function carouselVisual(args: {
  scene: ReelScene;
  pal: Palette;
  accent: string;
  variant: "circle" | "path" | "vision";
}): string | null {
  const images = [...new Set(args.scene.carouselImages ?? [])].slice(0, 12);
  if (images.length < 3) return null;
  const middle = (images.length - 1) / 2;
  const cards = images
    .map((url, index) => {
      const unit = middle === 0 ? 0 : (index - middle) / middle;
      const angle = (index / images.length) * Math.PI * 2 - Math.PI / 2;
      const x =
        args.variant === "circle"
          ? Math.cos(angle) * 31
          : unit * (args.variant === "path" ? 40 : 36);
      const y =
        args.variant === "circle"
          ? Math.sin(angle) * 24
          : args.variant === "path"
            ? Math.sin(unit * Math.PI) * 13
            : Math.abs(unit) * 10;
      const rotation =
        args.variant === "circle"
          ? (angle * 180) / Math.PI + 90
          : args.variant === "path"
            ? unit * 13
            : unit * -24;
      const scale =
        args.variant === "circle"
          ? 0.78 + ((Math.sin(angle) + 1) / 2) * 0.28
          : 1 - Math.abs(unit) * 0.22;
      return `<figure class="fx-carousel-card" data-carousel-card="${index}" style="--card-x:${x.toFixed(2)};--card-y:${y.toFixed(2)};--card-rotate:${rotation.toFixed(2)}deg;--card-scale:${scale.toFixed(3)};--card-z:${Math.round(scale * 100)}"><img src="${escapeHtml(url)}" alt="" draggable="false" /></figure>`;
    })
    .join("");
  return `
    ${stageShell(args.scene.id, args.pal, "stack-cards", `fx-carousel fx-carousel-${args.variant}`)}
      <div class="fx-carousel-copy">
        <p class="fx-kicker" style="color:${args.accent}">GALLERY</p>
        <div class="fx-stack" style="color:${args.pal.ink}">${lineStackHtml(args.scene.text, args.scene.emphasis, 24, "fx-line sans", 5)}</div>
      </div>
      <div class="fx-carousel-track" data-carousel="${args.variant}" data-card-count="${images.length}">${cards}</div>
    </div>`;
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
  const pal = paletteFor(scene.mood, tokens);
  const accent = tokens.accent ?? pal.c;
  const handle = tokens.handle?.replace(/^@/, "") || "yourbrand";
  const textHtml = emphasize(scene.text, scene.emphasis).replace(
    /\n/g,
    "<br/>",
  );
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

    case "logo-outro": {
      const domain = scene.visual?.trim();
      return `
        ${stageShell(sid, pal, "minimal-mark", "fx-outro")}
          <div class="fx-content">
            <div class="fx-logo-mark" style="border-color:${accent};color:${pal.ink}">${escapeHtml(handle.slice(0, 1).toUpperCase())}</div>
            <div class="fx-stack outro-stack" style="color:${pal.ink}">${lineStackHtml(scene.text, scene.emphasis, 22, "fx-line serif")}</div>
            ${domain ? `<p class="fx-pill" style="color:${pal.ink}">${escapeHtml(domain)}</p>` : ""}
          </div>
        </div>`;
    }

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
      const visual = escapeHtml(scene.visual || "—");
      const target = parseMoneyTargetLocal(scene.visual);
      const suffix = /%/.test(scene.visual || "")
        ? "%"
        : /×|x/i.test(scene.visual || scene.text)
          ? "×"
          : "";
      return `
        ${stageShell(sid, pal, "punch-block", "fx-money")}
          <div class="fx-content">
            <p class="fx-kicker" style="color:${accent}">PROOF</p>
            <p class="fx-money-num"${target === null ? "" : ` data-count-to="${target}" data-count-suffix="${suffix}"`} style="color:${pal.ink}">${visual}</p>
            <p class="fx-money-line" style="color:${pal.ink}">${textHtml}</p>
            <div class="fx-rule" style="background:${accent}"></div>
          </div>
        </div>`;
    }

    case "data-chart": {
      const chart = scene.chart;
      if (!chart) return null;
      const series = chart.series[0];
      const values = series.values.slice(0, 8);
      const maxMagnitude = Math.max(
        1,
        ...values.map((value) => Math.abs(value)),
      );
      const bars = values.map((value, index) => {
        const height = Math.max(
          8,
          Math.round((Math.abs(value) / maxMagnitude) * 96),
        );
        const unit = series.unit ?? "";
        return `<div class="fx-chart-bar" aria-label="${escapeHtml(`${chart.labels[index]}: ${value}${unit}`)}">
          <b style="color:${pal.ink}">${escapeHtml(`${value}${unit}`)}</b>
          <i style="--h:${height}%;background:linear-gradient(180deg, ${accent}, ${pal.b})"></i>
          <span>${escapeHtml(chart.labels[index])}</span>
        </div>`;
      });
      const chartBody = chartVariantHtml({
        kind: chart.kind ?? "bar",
        labels: chart.labels,
        values,
        unit: series.unit ?? "",
        accent,
        ink: pal.ink,
        barsHtml: bars.join(""),
      });
      return `
        ${stageShell(sid, pal, "terminal", "fx-chart")}
          <div class="fx-content fx-panelled">
            <div class="fx-dialogue fx-dlg-chart">
              <p class="fx-chart-title" style="color:${pal.ink}">${escapeHtml(scene.visual || scene.text.slice(0, 48))}</p>
              ${chartBody}
              <p class="fx-chart-line" style="color:${pal.ink}">${textHtml}</p>
              ${chart.sourceAttribution ? `<p class="fx-chart-source">${escapeHtml(chart.sourceAttribution)}</p>` : ""}
            </div>
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

    case "carousel-circle-1":
      return carouselVisual({ scene, pal, accent, variant: "circle" });
    case "carousel-path-1":
      return carouselVisual({ scene, pal, accent, variant: "path" });
    case "carousel-vision-1":
      return carouselVisual({ scene, pal, accent, variant: "vision" });

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
  /** Picture drawn inside the panel by scenes that frame their media. */
  mediaUrl?: string;
}): string {
  const { scene, tokens } = args;
  const pal = paletteFor(scene.mood, tokens);
  const accent = tokens.accent ?? pal.c;
  const speaker = speakerLabel(scene.visual);
  const textHtml = emphasize(scene.text, scene.emphasis).replace(
    /\n/g,
    "<br/>",
  );
  const sid = scene.id;
  const tpl = scene.templateId || "hf-statement";
  const recipe = recipeForTemplate(tpl, scene.mood);
  const chip = chipHtml(speaker, accent, pal.ink);
  // Every scene gets a non-text visual: the storyboard's icon, or one picked
  // from the scene's words, or the scene type's default.
  const panelData = (scene.panel ?? {}) as {
    icon?: string;
    sceneType?: string;
  };
  const iconName = iconForScene({
    text: `${scene.text} ${scene.spokenText ?? ""}`,
    type: panelData.sceneType,
    explicit: panelData.icon,
  });
  const badge = `<div class="fx-icon-badge" style="background:${accent};color:${onAccentColor(accent)}" data-icon="${iconName}">${iconSvg(iconName)}</div>`;
  const lead = `${chip}${badge}`;

  let body = "";
  const registered = sceneDefinitionForTemplate(tpl);
  const payload = registered?.schema.safeParse(scene.panel ?? {});
  if (registered && payload?.success) {
    body = `
        <div class="fx-dialogue fx-dlg-${registered.id}"${registered.fixedFill ? "" : " data-sc-grow"}>
          ${registered.fixedFill || registered.ownVisual ? "" : badge}
          ${registered.build(payload.data, {
            text: scene.text,
            emphasis: scene.emphasis,
            ink: pal.ink,
            accent,
            onAccent: onAccentColor(accent),
            chip,
            mediaUrl: args.mediaUrl,
            escape: escapeHtml,
            emphasize,
            lineStack: lineStackHtml,
          })}
        </div>`;
    return `
    ${stageShell(sid, pal, recipe, "fx-classic")}
      ${DECO_HTML}
      <div class="fx-content fx-panelled recipe-content-${recipe}">
        ${body}
      </div>
    </div>`;
  }
  switch (registered ? "hf-statement" : tpl) {
    case "hf-opener":
      body = `
        <div class="fx-dialogue fx-dlg-opener">
          <div class="fx-lt-plate" style="--accent:${accent}">
            ${lead}
            <div class="fx-stack opener-stack" style="color:${pal.ink}">${lineStackHtml(scene.text, scene.emphasis, 14, "fx-line sans", 3)}</div>
          </div>
        </div>`;
      break;
    case "hf-broll":
      body = `
        <div class="fx-dialogue fx-dlg-broll">
          <div class="fx-lt-plate fx-broll-plate" style="--accent:${accent}">
            <div class="fx-stack opener-stack" style="color:${pal.ink}">${lineStackHtml(scene.text, scene.emphasis, 14, "fx-line sans", 3)}</div>
          </div>
        </div>`;
      break;
    case "hf-quote":
      body = `
        <div class="fx-dialogue fx-dlg-quote">
          ${lead}
          <div class="fx-qmark" style="color:${accent}">“</div>
          <div class="fx-stack quote-stack" style="color:${pal.ink}">${lineStackHtml(scene.text, scene.emphasis, 22, "fx-line serif", 5)}</div>
        </div>`;
      break;
    case "hf-statement":
      body = `
        <div class="fx-dialogue fx-dlg-statement">
          ${lead}
          <div class="fx-stack statement-stack" style="color:${pal.ink}">${lineStackHtml(scene.text, scene.emphasis, 12, "fx-line", 2)}</div>
          <div class="fx-rule" style="background:${accent}"></div>
        </div>`;
      break;
    case "hf-list": {
      // Supplied items win; the scene text then becomes the title above them.
      const hasItems = (scene.items?.length ?? 0) > 0;
      const items = hasItems ? scene.items! : linesToItems(scene.text);
      body = `
        <div class="fx-dialogue fx-dlg-list">
          ${lead}
          ${hasItems ? `<p class="fx-list-title" style="color:${pal.ink}">${escapeHtml(scene.text)}</p>` : ""}
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
      const target = parseMoneyTargetLocal(scene.visual);
      const hasNum = target !== null;
      const countAttrs = hasNum
        ? ` data-count-to="${target}" data-count-suffix="${/%/.test(scene.visual || "") ? "%" : /×|x/i.test(scene.visual || "") ? "×" : ""}"`
        : "";
      body = `
        <div class="fx-dialogue fx-dlg-stat">
          ${lead}
          <p class="fx-money-num"${countAttrs} style="color:${accent};--chars:${Math.max(2, (scene.visual || "—").length)}">${escapeHtml(scene.visual || "—")}</p>
          <div class="fx-stack" style="color:${pal.ink}">${lineStackHtml(scene.text, scene.emphasis, 20, "fx-line sans")}</div>
        </div>`;
      break;
    }
    case "hf-cta":
      body = `
        <div class="fx-dialogue fx-dlg-cta">
          ${lead}
          <div class="fx-stack" style="color:${pal.ink}">${lineStackHtml(scene.text, scene.emphasis, 18)}</div>
          <div class="fx-cta-btn" style="background:${accent}">${escapeHtml(scene.visual || "Follow")}</div>
        </div>`;
      break;
    default:
      body = `
        <div class="fx-dialogue">
          ${lead}
          <div class="fx-stack" style="color:${pal.ink}">${lineStackHtml(scene.text || "", scene.emphasis, 18)}</div>
          ${!scene.text ? textHtml || args.innerHtml : ""}
        </div>`;
  }

  return `
    ${stageShell(sid, pal, recipe, "fx-classic")}
      <div class="fx-content fx-panelled recipe-content-${recipe}">
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
    background: var(--fx-a);
    color: var(--fx-ink);
  }
  .recipe-editorial .fx-paper {
    position: absolute; inset: 0;
    background:
      radial-gradient(80% 50% at 20% 0%, rgba(255,255,255,0.7), transparent 60%),
      linear-gradient(180deg, var(--fx-a), var(--fx-b));
  }
  .recipe-editorial .fx-paper::after {
    content: "";
    position: absolute; inset: 6% 7%;
    border: 1px solid color-mix(in oklab, var(--fx-ink) 12%, transparent);
    pointer-events: none;
  }
  .fx-paper-rule {
    position: absolute; left: 10%; right: 10%; top: 14%; height: 1px;
    background: color-mix(in oklab, var(--fx-ink) 18%, transparent); transform: scaleX(0); transform-origin: left;
  }
  .fx-paper-corner {
    position: absolute; right: 8%; bottom: 10%; width: 120px; height: 120px;
    border-right: 2px solid color-mix(in oklab, var(--fx-ink) 20%, transparent); border-bottom: 2px solid color-mix(in oklab, var(--fx-ink) 20%, transparent);
    opacity: 0; transform: translate(12px, 12px);
  }
  .recipe-editorial .fx-chip {
    color: var(--fx-ink) !important; border-color: color-mix(in oklab, var(--fx-ink) 35%, transparent);
    background: color-mix(in oklab, var(--fx-ink) 6%, transparent);
  }
  .recipe-editorial .fx-stack, .recipe-editorial .quote-stack { color: var(--fx-ink) !important; }
  .recipe-editorial .em { color: var(--fx-c); box-shadow: inset 0 -0.18em 0 0 color-mix(in oklab, var(--fx-c) 25%, transparent); }
  .recipe-editorial .fx-qmark { color: var(--fx-c) !important; opacity: 0.9; }

  /* —— recipe: lower-third (opener / host) —— */
  .recipe-lower-third .fx-studio {
    position: absolute; inset: 0;
    background:
      radial-gradient(70% 40% at 50% 0%, color-mix(in oklab, var(--fx-c) 22%, transparent), transparent 70%),
      linear-gradient(180deg, var(--fx-a), var(--fx-b), var(--fx-a));
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
    background: linear-gradient(90deg, color-mix(in oklab, var(--fx-a) 92%, transparent), color-mix(in oklab, var(--fx-b) 70%, transparent));
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
    background: var(--fx-b);
    box-shadow: inset 8px 0 var(--fx-c);
    transform: scaleX(0); transform-origin: left;
  }
  .fx-block-flash {
    position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none;
  }
  .recipe-punch-block .statement-stack { color: var(--fx-ink) !important; mix-blend-mode: normal; }

  /* —— recipe: terminal (tech questions) —— */
  .recipe-terminal .fx-term-bg {
    position: absolute; inset: 0;
    background: linear-gradient(180deg, var(--fx-a), var(--fx-b));
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
  /* Let complete copy flow across the real viewport instead of retaining a
     narrow two-word column in landscape. Keep the same nodes for GSAP seeks. */
  .statement-stack, .opener-stack, .quote-stack {
    flex-direction: row; flex-wrap: wrap; align-items: baseline;
    justify-content: center; font-size: clamp(30px, 4.8cqw, 56px);
    gap: 0.15em 0.25em;
  }
  .opener-stack, .quote-stack { justify-content: flex-start; }


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
    font-family: var(--brand-font, "Inter"), sans-serif; font-weight: 800;
    font-size: clamp(30px, 4.8cqw, 56px); letter-spacing: -0.03em;
    text-transform: none;
  }
  .statement-stack .fx-line {
    font-family: var(--brand-font, "Inter"), sans-serif; font-weight: 800;
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
    color: var(--fx-c);
    text-decoration-color: color-mix(in oklab, var(--fx-c) 45%, transparent);
  }
  .recipe-punch-block .em {
    color: var(--fx-ink);
    text-decoration-color: var(--fx-c);
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
  .fx-list-title { font-weight: 800; letter-spacing: -0.02em; line-height: 1.12; font-size: calc(var(--frame-h, 1920px) * 0.05); margin: 0 0 calc(var(--frame-h, 1920px) * 0.02); text-align: left; width: min(var(--content-max-width, 920px), 96%); }
  .fx-check-list { list-style: none; display: grid; gap: calc(var(--frame-h, 1920px) * 0.012); width: min(var(--content-max-width, 920px), 96%); text-align: left; }
  .fx-check-item {
    display: flex; gap: 18px; align-items: flex-start;
    font-size: calc(var(--frame-h, 1920px) * 0.034); font-weight: 700; line-height: 1.25;
    padding: 0.5em 0.6em; border-radius: 0.5em;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
    opacity: 0; transform: translateY(28px);
  }
  .fx-check-num {
    color: color-mix(in srgb, var(--fx-c, #ff5a5f) 70%, #fff) !important;
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
    margin: calc(var(--frame-h, 1920px) * 0.02) auto 0; display: inline-block; opacity: 0; transform: translateY(14px);
    font-size: calc(var(--frame-h, 1920px) * 0.03); padding: 0.5em 1.1em;
  }
  .fx-yt-btn { background: #f00; color: #fff; }
  .fx-panelled .fx-dlg-stat .fx-money-num { font-size: min(calc(var(--frame-h, 1920px) * 0.17), calc(70cqw / (var(--chars, 4) * 0.6))); }
  .fx-money-num {
    font-size: clamp(88px, 16cqw, 168px); font-weight: 800; letter-spacing: -0.05em;
    line-height: 0.95; opacity: 0; transform: translateY(24px);
  }
  .fx-money-line, .fx-chart-line {
    font-size: calc(var(--frame-h, 1920px) * 0.034); font-weight: 700; max-width: none;
    opacity: 0; transform: translateY(14px);
  }
  .fx-chart-title {
    font-family: "Instrument Serif", Georgia, serif; font-size: calc(var(--frame-h, 1920px) * 0.04); margin-bottom: calc(var(--frame-h, 1920px) * 0.012);
    opacity: 0; transform: translateY(10px);
  }
  .fx-chart-bars {
    display: flex; align-items: stretch; gap: calc(var(--frame-h, 1920px) * 0.01); flex: 1 1 auto; min-height: 30%; width: 100%;
    margin-bottom: calc(var(--frame-h, 1920px) * 0.012);
  }
  .fx-chart-bar {
    flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
    gap: 8px; color: rgba(255,255,255,.82); font-size: calc(var(--frame-h, 1920px) * 0.027); text-align: center;
  }
  .fx-chart-bar b { font-size: 1.15em; white-space: nowrap; }
  .fx-chart-bar span { width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .fx-chart-bars i {
    width: 100%; height: var(--h); border-radius: 10px 10px 4px 4px; display: block;
    background: linear-gradient(180deg, var(--fx-c), #333);
    transform: scaleY(0.08); transform-origin: bottom;
  }
  .fx-chart-source { max-width: none; font-size: calc(var(--frame-h, 1920px) * 0.027); opacity: .8; margin: 0; }
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
  .fx-carousel-copy {
    position: absolute; z-index: 120; left: 7%; right: 7%; top: 7%;
    display: flex; flex-direction: column; align-items: center; text-align: center;
    text-shadow: 0 3px 22px rgba(0,0,0,.7);
  }
  .fx-carousel-copy .fx-stack { max-width: min(86cqw, 900px); }
  .fx-carousel-copy .fx-line-inner { font-size: clamp(25px, 3.6cqw, 48px); }
  .fx-carousel-track { position: absolute; inset: 19% 3% 4%; perspective: 1000px; }
  .fx-carousel-card {
    position: absolute;
    left: calc(50% + var(--card-x) * 1cqw);
    top: calc(50% + var(--card-y) * 1cqh);
    z-index: var(--card-z);
    width: clamp(120px, 19cqw, 310px);
    aspect-ratio: 4 / 5;
    margin: 0;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,.28);
    border-radius: clamp(14px, 2cqw, 28px);
    background: #111;
    box-shadow: 0 24px 54px rgba(0,0,0,.46);
    opacity: 0;
    transform: translate(-50%, -50%) rotate(var(--card-rotate)) scale(var(--card-scale));
    transform-origin: center;
  }
  .fx-carousel-vision .fx-carousel-card { aspect-ratio: 3 / 4; }
  .fx-carousel-card img { width: 100%; height: 100%; display: block; object-fit: cover; }
  @container (max-aspect-ratio: 4 / 5) {
    .fx-carousel-copy { top: 11%; }
    .fx-carousel-track { inset: 23% 2% 8%; }
    .fx-carousel-card { width: clamp(112px, 27cqw, 260px); }
  }
  @container (min-aspect-ratio: 4 / 3) {
    .fx-carousel-copy { top: 5%; }
    .fx-carousel-track { inset: 26% 3% 2%; }
    .fx-carousel-card { width: min(15cqw, 24cqh); }
  }
  .fx-dialogue { position: relative; width: 100%; max-width: 96%; }
  /* Layout contract: a scene's content owns one region of the safe area (top
     and height come from the layout), and fills it. */
  .fx-content.fx-panelled { position: absolute; inset: 0; padding: 0; display: block; }
  .fx-panelled .fx-dialogue {
    position: absolute; left: var(--safe-left, 6%); right: var(--safe-right, 12%);
    top: var(--region-top, 14%); height: var(--region-height, 54%);
    width: auto; max-width: none; box-sizing: border-box;
    display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;
    padding: calc(var(--frame-h, 1920px) * 0.03) calc(var(--frame-h, 1920px) * 0.025);
    border-radius: calc(var(--frame-h, 1920px) * 0.022);
    background: color-mix(in srgb, var(--fx-ink, #fff) 6%, transparent);
    border: 2px solid color-mix(in srgb, var(--fx-c, #fff) 38%, transparent);
  }
  .fx-panelled .fx-dlg-chart { align-items: stretch; text-align: center; }
  .fx-panelled .fx-dlg-list,
  .fx-panelled .fx-dlg-quote { align-items: stretch; text-align: left; }
  .fx-panelled .fx-dlg-opener,
  .fx-panelled .fx-dlg-broll { display: flex; align-items: center; justify-content: center; }
  .fx-panelled .fx-lt-plate { width: 100%; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; }
  .fx-panelled .fx-dlg-opener, .fx-panelled .fx-dlg-broll { align-items: stretch; }
  .fx-dlg-quote { text-align: left; }
  .fx-dlg-list { text-align: left; }
  .fx-dlg-opener { width: 100%; display: flex; justify-content: stretch; }
  .fx-dlg-broll { width: 100%; display: flex; align-items: flex-end; }
  .fx-broll-plate { max-width: min(760px, 84%); }
  .fx-broll-plate .fx-kicker { margin-bottom: 12px; }
  .fx-icon-badge { flex: none; width: calc(var(--frame-h, 1920px) * 0.052); height: calc(var(--frame-h, 1920px) * 0.052); border-radius: 50%; display: grid; place-items: center; margin-bottom: calc(var(--frame-h, 1920px) * 0.012); }
  .fx-icon-svg { width: 58%; height: 58%; }
  .fx-panelled .fx-dlg-list .fx-icon-badge, .fx-panelled .fx-dlg-quote .fx-icon-badge, .fx-panelled .fx-dlg-steps .fx-icon-badge, .fx-panelled .fx-dlg-checklist .fx-icon-badge, .fx-panelled .fx-dlg-timeline .fx-icon-badge { align-self: flex-start; }
  .fx-deco { position: absolute; inset: 0; z-index: 3; pointer-events: none; overflow: hidden; display: none; }
  .fx-deco i { position: absolute; display: block; }
  #root[data-theme-bg="grid"] .fx-deco, #root[data-theme-bg="glow"] .fx-deco, #root[data-theme-bg="blocks"] .fx-deco,
  #root[data-theme-bg="blobs"] .fx-deco, #root[data-theme-bg="paper"] .fx-deco { display: block; }
  .fx-deco i:nth-child(1) { width: calc(var(--frame-h, 1920px) * 0.11); height: calc(var(--frame-h, 1920px) * 0.11); right: 4%; top: calc(2% + var(--fx-hue, 0) * 0.01%); border: calc(var(--frame-h, 1920px) * 0.004) solid var(--fx-c); border-radius: 50%; opacity: .55; }
  .fx-deco i:nth-child(2) { width: calc(var(--frame-h, 1920px) * 0.05); height: calc(var(--frame-h, 1920px) * 0.05); left: 3%; bottom: 12%; background: var(--fx-glow); opacity: .5; border-radius: 28%; }
  .fx-deco i:nth-child(3) { width: calc(var(--frame-h, 1920px) * 0.022); height: calc(var(--frame-h, 1920px) * 0.022); left: 46%; top: 3%; background: var(--fx-c); border-radius: 50%; opacity: .6; }
  #root[data-theme-bg="paper"] .fx-deco i:nth-child(1), #root[data-theme-bg="paper"] .fx-deco i:nth-child(2) { border-radius: 0; }
  #root[data-theme-bg="blocks"] .fx-deco i { border-radius: 0; }
${SCENE_STYLES}
${CHART_STYLES}
`;

/**
 * GSAP boot: line-reveal timelines (no mid-word translate collisions).
 */
export function buildGsapMotionBootScript(
  runtimeUrl = GSAP_PREVIEW_URL,
): string {
  return `
<script src="${escapeHtml(runtimeUrl)}"></script>
<script>
(function () {
  function revealFallback() {
    document.querySelectorAll('.fx-line-inner, .fx-kicker, .fx-rule, .fx-logo-mark, .fx-pill, .fx-social-card, .fx-yt-bar, .fx-money-num, .fx-money-line, .fx-chart-line, .fx-chart-title, .fx-phone, .fx-chip, .fx-qmark, .fx-check-item, .fx-rv, .fx-cta-btn, .fx-lt-plate, .fx-slash, .fx-letterbox, .fx-term-grid, .fx-chart-bars i, .fx-carousel-card, .tm-impact-shape, .tm-impact-rule, .tm-editorial-rail, .dm-row, .dm-bar-fill, .gm-step, .gm-core, .gm-satellite').forEach(function (el) {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    document.querySelectorAll('.am-shutter').forEach(function (el) { el.style.transform = "scaleX(0)"; });
    document.querySelectorAll('.dm-orbit-draw').forEach(function (el) { el.style.strokeDashoffset = el.getAttribute('data-dash-end') || '0'; });
    document.querySelectorAll('.gm-connector').forEach(function (el) { el.style.strokeDashoffset = '0'; });
  }
  function boot() {
    if (!window.gsap) { revealFallback(); return; }
    window.__timelines = window.__timelines || {};
    var compositionRoot = document.querySelector('[data-composition-id]');
    var compositionId = compositionRoot && compositionRoot.getAttribute('data-composition-id');
    var compositionTimelines = [];
    var libraryTiming = ${JSON.stringify(MOTION_LIBRARY_TIMING)};
    var storyTracks = ${JSON.stringify(STORY_MOTION_TRACKS)};
    var motionEvents = ${JSON.stringify(MOTION_EVENT_TIMINGS.hyperframes)};
    var typeMotifOffsets = ${JSON.stringify(TYPE_MOTIF_OFFSETS)};
    document.querySelectorAll('[data-motion-scene]').forEach(function (stage) {
      var id = stage.getAttribute('data-motion-scene');
      if (!id) return;
      var recipe = stage.getAttribute('data-recipe') || '';
      var typeEntrance = (recipe === 'type-impact' || recipe === 'type-editorial') ? stage.getAttribute('data-type-entrance') : null;
      var motif = typeMotifOffsets[typeEntrance];
      var scene = stage.closest('.scene[data-start]');
      var sceneDuration = Math.max(0.001, Number(scene && scene.getAttribute('data-duration') || 1.35));
      var repeatThroughScene = function (period, start) {
        return Math.max(0, Math.ceil((sceneDuration - start) / period) - 1);
      };
      var loopDuration = function (period, start) {
        return Math.max(0.001, sceneDuration - start) / (repeatThroughScene(period, start) + 1);
      };
      var tl = gsap.timeline({ paused: true, defaults: { force3D: false } });
      ${MULTI_SERIES_TIMELINE_BOOT}
      (storyTracks[recipe] || []).forEach(function(track) {
        var element = stage.querySelector(".sm-" + track.part);
        if (element) tl.fromTo(element, { opacity:0, x:track.x, y:track.y, scaleX:track.scaleX === undefined ? 1 : track.scaleX, scaleY:track.scaleY === undefined ? 1 : track.scaleY }, { opacity:1, x:0, y:0, scaleX:1, scaleY:1, force3D:false, duration:track.duration, ease:"power2.out" }, track.at);
      });
      var ambient = stage.querySelector('.ml-ambient');
      if (ambient) tl.fromTo(ambient, { xPercent:-4, opacity:libraryTiming.ambientLow }, { xPercent:4, opacity:libraryTiming.ambientHigh, duration:loopDuration(libraryTiming.ambientPeriod, 0), repeat:repeatThroughScene(libraryTiming.ambientPeriod, 0), yoyo:true, ease:'sine.inOut' }, 0);
      var trace = stage.querySelector('.ml-trace');
      if (trace) tl.fromTo(trace, { scaleX:0 }, { scaleX:1, duration:Math.min(1.2, sceneDuration * .35), ease:'power3.inOut' }, 0.08);
      var folio = stage.querySelector('.tm-folio');
      if (folio) tl.fromTo(folio, { y:32, opacity:0 }, { y:0, opacity:1, duration:.9, ease:'power2.out' }, .1);
      var transfer = stage.querySelector('.sm-transfer svg');
      if (transfer) tl.fromTo(transfer, { opacity:0, scaleX:0, transformOrigin:'left center' }, { opacity:1, scaleX:1, duration:.5, ease:'power3.out' }, .38);
      var events = motionEvents[recipe];
      if (events) {
        tl.addLabel("reveal", events.reveal);
        if (events.impact !== undefined) tl.addLabel("impact", events.impact);
      }

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
      var carouselCards = stage.querySelectorAll('.fx-carousel-card');
      var typeShape = stage.querySelector('.tm-impact-shape');
      var typeRule = stage.querySelector('.tm-impact-rule');
      var typeRail = stage.querySelector('.tm-editorial-rail');
      var dataOrbit = stage.querySelector('.dm-orbit-draw');
      var dataRows = stage.querySelectorAll('.dm-row');
      var dataBars = stage.querySelectorAll('.dm-bar-fill');
      var diagramSteps = stage.querySelectorAll('.gm-step');
      var diagramCore = stage.querySelector('.gm-core');
      var diagramSatellites = stage.querySelectorAll('.gm-satellite');

      if (recipe === 'type-impact') {
        if (typeShape) {
          if (typeEntrance === 'rise') tl.fromTo(typeShape, { scaleX: 1, scaleY: 0, rotation: -11 }, { scaleX: 1, scaleY: 1, rotation: -11, duration: 0.58, ease: 'power4.out' }, 0.02);
          else tl.fromTo(typeShape, { scaleX: 0, rotation: -11 }, { scaleX: 1, rotation: -11, duration: 0.58, ease: 'power4.out' }, 0.02);
        }
        if (typeRule) tl.fromTo(typeRule, { scaleX: 0 }, { scaleX: 1, duration: 0.42, ease: 'power3.out' }, events.impact);
      }
      if (recipe === 'type-editorial' && typeRail) {
        tl.fromTo(typeRail, { scaleX: 0 }, { scaleX: 1, duration: 0.78, ease: 'power2.out' }, 0.04);
      }
      if (recipe === 'data-spotlight' && dataOrbit) {
        var orbitEnd = Number(dataOrbit.getAttribute('data-dash-end') || '0');
        tl.fromTo(dataOrbit, { strokeDashoffset: 893 }, { strokeDashoffset: orbitEnd, duration: 1.25, ease: 'power2.out' }, events.reveal);
      }
      if (recipe === 'data-bars') {
        dataRows.forEach(function (row, i) {
          tl.fromTo(row, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.42, ease: 'power2.out' }, 0.2 + i * 0.11);
        });
        dataBars.forEach(function (bar, i) {
          tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: 'power3.out' }, events.reveal + i * 0.11);
        });
      }
      if (recipe === 'diagram-path') {
        diagramSteps.forEach(function (step, i) {
          tl.fromTo(step, { opacity: 0, x: 46 }, { opacity: 1, x: 0, duration: 0.48, ease: 'power3.out' }, events.reveal + i * 0.15);
        });
      }
      if (recipe === 'diagram-orbit') {
        if (diagramCore) tl.fromTo(diagramCore, { opacity: 0, scale: 0.65, transformOrigin: '500px 500px' }, { opacity: 1, scale: 1, duration: 0.65, ease: 'back.out(1.4)' }, 0.2);
        diagramSatellites.forEach(function (node, i) {
          tl.fromTo(node, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power2.out' }, events.reveal + i * 0.16);
          var path = node.querySelector('.gm-connector');
          if (path) tl.fromTo(path, { strokeDashoffset: 700 }, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.out' }, 0.52 + i * 0.16);
        });
      }

      ${SEQUENCE_HANDOFF_BOOT}${ADAPTIVE_BOOT}${DESIGN_MOTION_BOOT}
${CELESTIAL_BOOT}${SHOWPIECE_BOOT}
${SEMANTIC_GRAPHIC_BOOT}

      // Recipe-specific backgrounds
      if (recipe === 'void-slash') {
        letterbox.forEach(function (el) { tl.fromTo(el, { scaleY: 0 }, { scaleY: 1, duration: 0.35, ease: 'power3.out', overwrite: 'auto', immediateRender: false }, 0); });
        var panel = stage.querySelector('.fx-void-panel');
        if (panel) tl.fromTo(panel, { xPercent: -55 }, { xPercent: -8, duration: 0.75, ease: 'power3.out' }, 0);
        slash.forEach(function (el, i) {
          tl.to(el, { scaleX: 1, duration: 0.55, ease: 'power4.out' }, 0.08 + i * 0.12);
          tl.to(el, { opacity: i ? 0.25 : 0.55, duration: 0.6 }, 0.7);
        });
      }
      if (recipe === 'editorial') {
        if (paperRule) tl.fromTo(paperRule, { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: 'power2.out' }, 0.05);
        if (corner) tl.fromTo(corner, { opacity: 0, x: 12, y: 12 }, { opacity: 1, x: 0, y: 0, duration: 0.55, ease: 'power2.out' }, 0.2);
      }
      if (recipe === 'lower-third') {
        if (beam) tl.fromTo(beam, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.8, ease: 'power2.out' }, 0);
        if (floor) tl.to(floor, { opacity: 1, duration: 0.7 }, 0.1);
        letterbox.forEach(function (el) { tl.fromTo(el, { scaleY: 0 }, { scaleY: 1, duration: 0.3, ease: 'power2.out', overwrite: 'auto', immediateRender: false }, 0); });
        if (plate) tl.fromTo(plate, { opacity: 0, x: -48 }, { opacity: 1, x: 0, duration: 0.55, ease: 'power3.out' }, 0.15);
      }
      if (recipe === 'punch-block') {
        if (blockB) tl.fromTo(blockB, { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: 'power4.inOut' }, 0);
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
      if (recipe === 'minimal-mark' && ring) tl.fromTo(ring, { opacity: 0, scale: 0.7 }, { opacity: 0.5, scale: 1, duration: 0.8, ease: 'power2.out' }, 0.1);
      if (recipe === 'social-plate' && blob) tl.to(blob, { opacity: 0.8, duration: 0.7 }, 0);

      if (chip) tl.fromTo(chip, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out' }, 0.12);
      if (qmark) tl.fromTo(qmark, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }, 0.15);
      if (kicker) {
        if (motif) tl.fromTo(kicker, { opacity: 0, x: motif.kickerX, y: motif.kickerY }, { opacity: 1, x: 0, y: 0, force3D: false, duration: 0.3, ease: 'power2.out' }, 0.1);
        else tl.fromTo(kicker, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }, 0.1);
      }

      var revealDuration = Math.min(1.5, Math.max(.15, Number(stage.getAttribute('data-text-reveal-duration')) || .42));
      var lineRevealDuration = function(start) { return stage.hasAttribute('data-text-reveal-duration') ? Math.min(revealDuration, Math.max(.01, sceneDuration - start)) : (persona ? persona.d : .42); };
      var rootEl = document.getElementById('root');
      var persona = ({snappy:{ease:'power4.out',d:.3,s:.08}, smooth:{ease:'power2.inOut',d:.5,s:.12}, punchy:{ease:'back.out(1.8)',d:.35,s:.09}, calm:{ease:'sine.out',d:.6,s:.16}, bouncy:{ease:'back.out(2.6)',d:.55,s:.11}, hard:{ease:'power4.in',d:.22,s:.1}, slow:{ease:'power1.out',d:.8,s:.22}})[rootEl ? rootEl.getAttribute('data-theme-motion') : ''] || null;
      // Scene entrance from the theme's transition (cut adds nothing).
      var transitionKind = stage.closest('.scene') ? stage.closest('.scene').getAttribute('data-transition') : null;
      if (transitionKind === 'push') tl.fromTo(stage, { x: stage.clientWidth * 0.08 }, { x: 0, duration: 0.45, ease: 'power3.out' }, 0);
      else if (transitionKind === 'wipe') tl.fromTo(stage, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.5, ease: 'power2.inOut' }, 0);
      else if (transitionKind === 'zoom') tl.fromTo(stage, { scale: 1.14, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.5, ease: 'power3.out' }, 0);
      // Per-video look: motion variant of the entrance and an eased camera move.
      var lookScene = stage.closest('.scene');
      var motionKind = lookScene ? lookScene.getAttribute('data-motion') : null;
      var cameraKind = lookScene ? lookScene.getAttribute('data-camera') : null;
      var dialogueEl = stage.querySelector('.fx-dialogue');
      if (dialogueEl && motionKind === 'slide') tl.fromTo(dialogueEl, { x: -stage.clientWidth * 0.05, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }, 0.04);
      else if (dialogueEl && motionKind === 'pop') tl.fromTo(dialogueEl, { scale: 0.93, opacity: 0, transformOrigin: '50% 50%' }, { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(1.6)' }, 0.04);
      else if (dialogueEl && motionKind === 'drift') tl.fromTo(dialogueEl, { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'sine.out' }, 0.04);
      var cameraEl = stage.querySelector('.fx-content');
      var cameraSpan = Math.max(1.5, sceneDuration);
      if (cameraEl && cameraKind === 'push-in') tl.fromTo(cameraEl, { scale: 1, transformOrigin: '50% 50%' }, { scale: 1.05, duration: cameraSpan, ease: 'sine.inOut' }, 0);
      else if (cameraEl && cameraKind === 'pull-out') tl.fromTo(cameraEl, { scale: 1.06, transformOrigin: '50% 50%' }, { scale: 1, duration: cameraSpan, ease: 'sine.inOut' }, 0);
      else if (cameraEl && cameraKind === 'pan') tl.fromTo(cameraEl, { x: -stage.clientWidth * 0.018 }, { x: stage.clientWidth * 0.018, duration: cameraSpan, ease: 'sine.inOut' }, 0);
      // Parallax: the background shapes travel against the camera at their own depth.
      if (cameraKind && cameraKind !== 'none') stage.querySelectorAll('.fx-deco i').forEach(function (el, i) {
        tl.fromTo(el, { x: 0 }, { x: (cameraKind === 'pan' ? -1 : 1) * (i + 1) * stage.clientWidth * 0.012, duration: cameraSpan, ease: 'sine.inOut' }, 0);
      });
      var revealEase = {linear:'none', smooth:'power2.inOut', snappy:'power3.out'}[stage.getAttribute('data-text-reveal-ease')] || (persona ? persona.ease : 'power3.out');
      // Line reveals — clipped, never overlapping
      (stage.hasAttribute('data-design-block') ? [] : lines).forEach(function (inner, i) {
        if (motif) tl.fromTo(inner, { x: motif.x, y: motif.y, opacity: 0 }, { x: 0, y: 0, opacity: 1, force3D: false, duration: lineRevealDuration(events.reveal + i * .1), ease: revealEase }, events.reveal + i * 0.1);
        else tl.fromTo(inner, { y: '110%' }, { y: '0%', duration: lineRevealDuration((recipe.startsWith('type-') ? events.reveal : .22) + i * (persona ? persona.s : .1)), ease: revealEase }, (recipe.startsWith('type-') ? events.reveal : 0.22) + i * (persona ? persona.s : 0.1));
      });

      if (rule) tl.fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: 'power3.out' }, Math.max(0.55, 0.22 + lines.length * 0.1));
      stage.querySelectorAll('.fx-rv').forEach(function (item, i) {
        tl.fromTo(item, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: persona ? persona.d : 0.4, ease: persona ? persona.ease : 'power3.out' }, 0.25 + i * (persona ? persona.s * 1.6 : 0.16));
      });
      checks.forEach(function (item, i) {
        tl.fromTo(item, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }, 0.25 + i * 0.16);
      });
      if (logo) tl.fromTo(logo, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.55, ease: 'back.out(1.5)' }, 0.15);
      if (pill) tl.to(pill, { opacity: 1, duration: 0.35 }, 0.7);
      if (card) tl.fromTo(card, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 0.4);
      if (money) {
        tl.fromTo(money, { opacity: 0, y: 36, scale: 0.86 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'back.out(1.6)' }, 0.12);
        // Keep the exact supplied amount. Callback counters are not seek-safe
        // when the producer suppresses timeline events. Reveal the factual
        // value through native transforms instead of displaying a false zero.
      }
      if (moneyLine) tl.fromTo(moneyLine, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4 }, 0.5);
      if (chartTitle) tl.fromTo(chartTitle, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35 }, 0.1);
      bars.forEach(function (b, i) {
        tl.fromTo(b, { scaleY: 0.08 }, { scaleY: 1, duration: 0.5, ease: 'power3.out' }, 0.25 + i * 0.07);
      });
      if (phone) tl.fromTo(phone, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 0.1);
      if (cta) tl.fromTo(cta, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }, 0.5);
      carouselCards.forEach(function (carouselCard, i) {
        tl.to(carouselCard, { opacity: 1, duration: 0.32, ease: 'power2.out' }, 0.12 + i * 0.045);
        tl.to(carouselCard, { rotation: '+=4', scale: '+=0.025', duration: loopDuration(1.8, 0.55 + i * 0.03), yoyo: true, repeat: repeatThroughScene(1.8, 0.55 + i * 0.03), ease: 'sine.inOut' }, 0.55 + i * 0.03);
      });

      stage.querySelectorAll('.fx-deco i').forEach(function (el, i) {
        tl.fromTo(el, { y: 0, rotation: 0 }, { y: i % 2 ? -26 : 22, rotation: i % 2 ? 24 : -18, duration: Math.max(1.5, sceneDuration), ease: 'sine.inOut' }, 0);
      });
      // Ambient life after the entrance so long VO doesn't freeze into a poster.
      var holdEnd = Math.max(tl.duration(), 1.35);
      if (scan) {
        tl.to(scan, { y: '160%', opacity: 0.55, duration: loopDuration(2.4, holdEnd * 0.15), ease: 'none', repeat: repeatThroughScene(2.4, holdEnd * 0.15) }, holdEnd * 0.15);
      }
      if (deepOrb) {
        tl.to(deepOrb, { scale: 1.08, duration: loopDuration(2.2, holdEnd * 0.2), yoyo: true, repeat: repeatThroughScene(2.2, holdEnd * 0.2), ease: 'sine.inOut' }, holdEnd * 0.2);
      }
      slash.forEach(function (el, i) {
        tl.to(el, { x: i ? 24 : -18, duration: loopDuration(2.6, holdEnd * 0.25), yoyo: true, repeat: repeatThroughScene(2.6, holdEnd * 0.25), ease: 'sine.inOut' }, holdEnd * 0.25);
      });
      if (beam) {
        tl.to(beam, { opacity: 0.85, scale: 1.05, duration: loopDuration(1.8, holdEnd * 0.2), yoyo: true, repeat: repeatThroughScene(1.8, holdEnd * 0.2), ease: 'sine.inOut' }, holdEnd * 0.2);
      }
      if (shine) {
        tl.to(shine, { x: '18%', duration: loopDuration(2.4, 0.4), yoyo: true, repeat: repeatThroughScene(2.4, 0.4), ease: 'sine.inOut' }, 0.4);
      }

      if (tl.duration() < 1.35) tl.to({}, { duration: 1.35 }, 0);
      tl.seek(Math.min(tl.duration(), 1.1));
      window.__timelines[id] = tl;

      var sceneStart = Number(scene && scene.getAttribute('data-start') || 0);
      compositionTimelines.push({ timeline: tl, start: Math.max(0, sceneStart), scene: scene, duration: sceneDuration });
    });

    ${GRAPH_TIMELINE_BOOT}
    // Producer 0.8 drives the timeline registered under the composition ID.
    // Keep per-scene timelines available for the editor while composing them
    // into one seekable root timeline for deterministic frame capture.
    if (compositionId) {
      var rootTimeline = gsap.timeline({ paused: true });
      compositionTimelines.forEach(function (entry) {
        rootTimeline.add(entry.timeline, entry.start);
        entry.timeline.paused(false);
        if (entry.scene) {
          // CSS visual variables are tweened directly: native render seeks may
          // suppress callbacks, so onUpdate cannot own transition state.
          rootTimeline.fromTo(entry.scene, { '--enter': 0 }, { '--enter': 1, duration: Math.min(0.25, entry.duration * 0.2), ease: 'none', immediateRender: false }, entry.start);
          rootTimeline.fromTo(entry.scene, { '--p': 0 }, { '--p': 1, duration: entry.duration, ease: 'none', immediateRender: false }, entry.start);

        }
      });
      compositionRoot.querySelectorAll('.scene-handoff').forEach(function (handoff) {
        var scene = handoff.closest('.scene');
        var start = Number(scene.dataset.start || 0);
        var duration = Number(scene.dataset.duration || 0);
        if (handoff.dataset.firstScene !== '1') {
          rootTimeline.fromTo(handoff, { '--handoff': 0 }, { '--handoff': 1, duration: Math.min(0.65, duration * 0.35), ease: 'none', immediateRender: false }, start);
        }
      });
      var authoredDuration = Number(compositionRoot.getAttribute('data-duration') || 0);
      if (authoredDuration > rootTimeline.duration()) {
        rootTimeline.to({}, { duration: authoredDuration }, 0);
      }
      rootTimeline.seek(0);
      window.__timelines[compositionId] = rootTimeline;
    }
  }
  // The script is emitted after the complete scene DOM. Register timelines
  // synchronously so a native seek cannot race a later window-load handler.
  boot();
  setTimeout(function () { if (!window.gsap) revealFallback(); }, 2500);
})();
</script>`;
}
