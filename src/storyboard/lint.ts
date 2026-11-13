/**
 * Storyboard linter with auto-repair.
 *
 * `lintStoryboard(input)` takes whatever a model returned (a JSON string with
 * prose or code fences around it, or an object), repairs what can be repaired
 * safely, and reports everything it did:
 *
 *   - `fixes`: repairs that were applied (the returned storyboard includes them)
 *   - `warnings`: valid but weak storyboards (advice for the writer)
 *   - `errors`: only what cannot be repaired, each with `path`, `message`,
 *     `expected` and `example` so an agent can fix it in one retry
 *
 * Pure and deterministic: no network, no clock unless `options.today` is
 * omitted for a missing source date.
 */
import { ZodError } from "zod";

import {
  FORMATS,
  SCENE_TYPES,
  STORYBOARD_LIMITS as L,
  parseStoryboard,
  type Storyboard,
} from "./schema";

export interface LintFix {
  path: string;
  rule: string;
  message: string;
}
export interface LintWarning {
  path: string;
  rule: string;
  message: string;
}
export interface LintError {
  path: string;
  message: string;
  expected: string;
  example: string;
}
export interface LintResult {
  storyboard: Storyboard | null;
  fixes: LintFix[];
  warnings: LintWarning[];
  errors: LintError[];
}
export interface LintOptions {
  /** Requested length range; a storyboard outside it gets a warning. */
  minSeconds?: number;
  maxSeconds?: number;
  /** Date used when a source lacks `accessed`. Defaults to today (UTC). */
  today?: string;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const WORDS_PER_SECOND = 2.5;
const MIN_SCENE_SECONDS = 2;

/** Rough spoken length of a video storyboard. */
export function estimateDurationSeconds(storyboard: Storyboard): number {
  if (storyboard.kind === "podcast") {
    return storyboard.turns.reduce(
      (sum, t) => sum + countWords(t.text) / WORDS_PER_SECOND,
      0,
    );
  }
  return storyboard.scenes.reduce(
    (sum, s) =>
      sum +
      Math.max(
        MIN_SCENE_SECONDS,
        countWords(s.narration) / WORDS_PER_SECOND,
        s.durationHint ?? 0,
      ),
    0,
  );
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim();
const norm = (s: string) =>
  squash(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, "");

/** Cut `text` to at most `max` characters at a sentence, clause or word boundary. */
export function cutAtBoundary(text: string, max: number): string {
  const t = squash(text);
  if (t.length <= max) return t;
  const head = t.slice(0, max + 1);
  const sentence = Math.max(
    head.lastIndexOf(". "),
    head.lastIndexOf("! "),
    head.lastIndexOf("? "),
  );
  if (sentence >= max * 0.4) return t.slice(0, sentence + 1).trim();
  const clause = Math.max(
    head.lastIndexOf(", "),
    head.lastIndexOf("; "),
    head.lastIndexOf(": "),
    head.lastIndexOf(" - "),
    head.lastIndexOf(" – "),
    head.lastIndexOf(" — "),
  );
  if (clause >= (max <= 80 ? 12 : max * 0.4)) {
    return t
      .slice(0, clause)
      .replace(/[,;:\-–—\s]+$/, "")
      .trim();
  }
  const word = head.lastIndexOf(" ");
  const cut = word > 0 ? t.slice(0, word) : t.slice(0, max);
  return cut.replace(/[,;:\-–—\s]+$/, "").trim();
}

const TYPE_ALIASES: Record<string, (typeof SCENE_TYPES)[number]> = {
  "bullet-list": "list",
  bullets: "list",
  bulleted: "list",
  checklist: "list",
  steps: "list",
  tips: "list",
  title: "hook",
  intro: "hook",
  opener: "hook",
  opening: "hook",
  "title-card": "hook",
  statistic: "stat",
  metric: "stat",
  number: "stat",
  "big-number": "stat",
  graph: "chart",
  data: "chart",
  "bar-chart": "chart",
  outro: "cta",
  closing: "cta",
  close: "cta",
  "call-to-action": "cta",
  quotation: "quote",
  testimonial: "quote",
  image: "media",
  video: "media",
  broll: "media",
  "b-roll": "media",
  photo: "media",
  visual: "media",
  snippet: "code",
  text: "statement",
  paragraph: "statement",
  explanation: "statement",
  point: "statement",
  idea: "statement",
  body: "statement",
  scene: "statement",
};

const FORMAT_ALIASES: Record<string, (typeof FORMATS)[number]> = {
  "9:16": "9:16",
  "9x16": "9:16",
  "9/16": "9:16",
  vertical: "9:16",
  portrait: "9:16",
  reel: "9:16",
  reels: "9:16",
  shorts: "9:16",
  "16:9": "16:9",
  "16x9": "16:9",
  "16/9": "16:9",
  landscape: "16:9",
  horizontal: "16:9",
  widescreen: "16:9",
  youtube: "16:9",
  "1:1": "1:1",
  "1x1": "1:1",
  "1/1": "1:1",
  square: "1:1",
};

const ROOT_KEYS = {
  video: [
    "version",
    "kind",
    "title",
    "format",
    "theme",
    "voice",
    "music",
    "captions",
    "sources",
    "scenes",
  ],
  podcast: [
    "version",
    "kind",
    "title",
    "music",
    "sources",
    "speakers",
    "turns",
  ],
};
const SCENE_KEYS = [
  "type",
  "headline",
  "narration",
  "body",
  "items",
  "stat",
  "chart",
  "quote",
  "code",
  "media",
  "icon",
  "emphasis",
  "durationHint",
];

/** Field names models commonly use for the real field. First match wins. */
const SCENE_FIELD_ALIASES: Record<string, string[]> = {
  headline: [
    "title",
    "heading",
    "onScreenText",
    "on_screen_text",
    "text",
    "caption",
  ],
  narration: [
    "voiceover",
    "voiceOver",
    "voice_over",
    "script",
    "spoken",
    "speech",
    "vo",
    "narrationText",
  ],
  body: ["subtitle", "subheadline", "subhead", "description", "supportingText"],
  items: ["bullets", "points", "list", "steps"],
  durationHint: ["duration", "seconds", "durationSeconds", "duration_seconds"],
};

function drop(obj: Obj, allowed: string[], path: string, fixes: LintFix[]) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      delete obj[key];
      fixes.push({
        path: path ? `${path}.${key}` : key,
        rule: "drop-unknown-field",
        message: `Removed unknown field "${key}"`,
      });
    }
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Pull a JSON object out of a model reply: fences, prose, trailing commas. */
export function extractJson(text: string, fixes: LintFix[]): unknown {
  let candidate = text.trim().replace(/^﻿/, "");
  const fenced = /```(?:json|JSON)?[ \t]*\r?\n([\s\S]*?)\r?\n```/.exec(
    candidate,
  );
  if (fenced) {
    candidate = fenced[1]!.trim();
    fixes.push({
      path: "",
      rule: "extract-json",
      message: "Removed the code fence and text around the JSON",
    });
  }
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first === -1 || last <= first)
    throw new SyntaxError("No JSON object found");
  if (first > 0 || last < candidate.length - 1) {
    candidate = candidate.slice(first, last + 1);
    if (!fenced) {
      fixes.push({
        path: "",
        rule: "extract-json",
        message: "Removed the text around the JSON",
      });
    }
  }
  try {
    return JSON.parse(candidate);
  } catch (error) {
    const withoutTrailingCommas = candidate.replace(/,(\s*[}\]])/g, "$1");
    if (withoutTrailingCommas !== candidate) {
      const parsed = JSON.parse(withoutTrailingCommas) as unknown;
      fixes.push({
        path: "",
        rule: "trailing-commas",
        message: "Removed trailing commas",
      });
      return parsed;
    }
    throw error;
  }
}

function str(value: unknown): string | undefined {
  if (typeof value === "string") return squash(value);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function repairScene(
  raw: unknown,
  path: string,
  fixes: LintFix[],
  warnings: LintWarning[],
): unknown {
  if (!isObj(raw)) return raw;
  const scene: Obj = { ...raw };

  // Field aliases.
  for (const [field, aliases] of Object.entries(SCENE_FIELD_ALIASES)) {
    if (scene[field] !== undefined) continue;
    const alias = aliases.find((a) => scene[a] !== undefined);
    if (alias) {
      scene[field] = scene[alias];
      delete scene[alias];
      fixes.push({
        path: `${path}.${field}`,
        rule: "rename-field",
        message: `Used "${alias}" as "${field}"`,
      });
    }
  }

  // Type.
  if (typeof scene.type === "string") {
    const key = squash(scene.type)
      .toLowerCase()
      .replace(/[_\s]+/g, "-");
    const mapped = (SCENE_TYPES as readonly string[]).includes(key)
      ? key
      : TYPE_ALIASES[key];
    if (mapped) {
      if (mapped !== scene.type) {
        fixes.push({
          path: `${path}.type`,
          rule: "map-enum",
          message: `Mapped scene type "${scene.type}" to "${mapped}"`,
        });
      }
      scene.type = mapped;
    } else {
      const inferred = scene.items
        ? "list"
        : scene.stat
          ? "stat"
          : scene.chart
            ? "chart"
            : scene.quote
              ? "quote"
              : scene.code
                ? "code"
                : scene.media
                  ? "media"
                  : "statement";
      fixes.push({
        path: `${path}.type`,
        rule: "map-enum",
        message: `Unknown scene type "${String(scene.type)}"; used "${inferred}"`,
      });
      scene.type = inferred;
    }
  }

  // Text fields.
  for (const key of ["headline", "narration", "body", "icon"] as const) {
    if (scene[key] === undefined) continue;
    const text = str(scene[key]);
    if (text === undefined) continue;
    if (text !== scene[key]) {
      fixes.push({
        path: `${path}.${key}`,
        rule: "trim",
        message: `Trimmed whitespace in ${key}`,
      });
    }
    scene[key] = text;
    if (text === "") delete scene[key];
  }

  // Missing headline or narration.
  if (scene.headline === undefined && typeof scene.narration === "string") {
    scene.headline = cutAtBoundary(scene.narration, L.headline);
    fixes.push({
      path: `${path}.headline`,
      rule: "derive-headline",
      message: "Derived a headline from the narration",
    });
  }
  if (scene.narration === undefined && typeof scene.headline === "string") {
    scene.narration =
      typeof scene.body === "string" && scene.body
        ? scene.body
        : scene.headline;
    fixes.push({
      path: `${path}.narration`,
      rule: "derive-narration",
      message: "Used the on-screen text as narration",
    });
  }

  // Overlong text.
  if (
    typeof scene.headline === "string" &&
    scene.headline.length > L.headline
  ) {
    const original = scene.headline;
    scene.headline = cutAtBoundary(original, L.headline);
    if (scene.body === undefined && original.length <= L.body) {
      scene.body = original;
      fixes.push({
        path: `${path}.headline`,
        rule: "headline-to-body",
        message: `Moved the ${original.length}-character headline into body and shortened the headline at a clause boundary`,
      });
    } else {
      fixes.push({
        path: `${path}.headline`,
        rule: "shorten-headline",
        message: `Shortened a ${original.length}-character headline at a clause boundary`,
      });
      warnings.push({
        path: `${path}.headline`,
        rule: "headline-cut",
        message:
          "The headline was too long and body was already used, so the end of the headline was dropped",
      });
    }
  }
  if (
    typeof scene.narration === "string" &&
    scene.narration.length > L.narration
  ) {
    const cut = cutAtBoundary(scene.narration, L.narration);
    fixes.push({
      path: `${path}.narration`,
      rule: "shorten-narration",
      message: `Cut narration from ${scene.narration.length} to ${cut.length} characters at a sentence boundary`,
    });
    scene.narration = cut;
  }
  if (typeof scene.body === "string" && scene.body.length > L.body) {
    const cut = cutAtBoundary(scene.body, L.body);
    fixes.push({
      path: `${path}.body`,
      rule: "shorten-body",
      message: `Cut body from ${scene.body.length} to ${cut.length} characters`,
    });
    scene.body = cut;
  }

  // Items.
  if (typeof scene.items === "string") {
    scene.items = scene.items
      .split(/\r?\n|;/)
      .map((s) => s.replace(/^[-*•\d.)\s]+/, ""));
    fixes.push({
      path: `${path}.items`,
      rule: "split-items",
      message: "Split items text into a list",
    });
  }
  if (Array.isArray(scene.items)) {
    const items = scene.items
      .map((item) =>
        isObj(item) ? str(item.text ?? item.label ?? item.title) : str(item),
      )
      .filter((item): item is string => Boolean(item));
    if (items.length > L.itemCount.max) {
      fixes.push({
        path: `${path}.items`,
        rule: "clamp-items",
        message: `Kept the first ${L.itemCount.max} of ${items.length} items`,
      });
    }
    scene.items = items.slice(0, L.itemCount.max).map((item, i) => {
      if (item.length <= L.item) return item;
      const cut = cutAtBoundary(item, L.item);
      fixes.push({
        path: `${path}.items.${i}`,
        rule: "shorten-item",
        message: "Shortened an overlong list item",
      });
      return cut;
    });
    if (scene.type === "list" && (scene.items as string[]).length === 1) {
      const only = (scene.items as string[])[0]!;
      scene.type = "statement";
      delete scene.items;
      if (scene.body === undefined) scene.body = only;
      fixes.push({
        path: `${path}.type`,
        rule: "list-one-item",
        message: "A list with one item became a statement",
      });
      warnings.push({
        path: `${path}.items`,
        rule: "list-one-item",
        message: "A list needs at least two items; converted to a statement",
      });
    }
  }

  // Fields models put on the scene instead of inside their object.
  if (
    scene.stat === undefined &&
    (typeof scene.value === "string" || typeof scene.value === "number")
  ) {
    scene.stat = {
      value: String(scene.value),
      label: scene.label ?? scene.headline,
    };
    delete scene.value;
    delete scene.label;
    fixes.push({
      path: `${path}.stat`,
      rule: "gather-fields",
      message: "Gathered scene-level value and label into stat",
    });
  }
  if (typeof scene.code === "string" && typeof scene.language === "string") {
    scene.code = { language: scene.language, text: scene.code };
    delete scene.language;
    fixes.push({
      path: `${path}.code`,
      rule: "gather-fields",
      message: "Gathered scene-level language and code into code",
    });
  }
  if (typeof scene.quote === "string") {
    const who = [
      scene.attribution,
      scene.author,
      scene.speaker,
      scene.source,
    ].find((v) => typeof v === "string");
    if (who !== undefined) {
      scene.quote = { text: scene.quote, attribution: who };
      delete scene.attribution;
      delete scene.author;
      delete scene.speaker;
      fixes.push({
        path: `${path}.quote`,
        rule: "gather-fields",
        message: "Gathered the quote and its attribution into quote",
      });
    }
  }
  if (scene.type === "cta" && scene.body === undefined) {
    const action = [scene.cta, scene.action, scene.buttonText].find(
      (v) => typeof v === "string" && v.trim(),
    );
    if (typeof action === "string") {
      scene.body = cutAtBoundary(action, L.body);
      fixes.push({
        path: `${path}.body`,
        rule: "rename-field",
        message: "Used the call-to-action text as body",
      });
    }
  }

  // Stat.
  if (typeof scene.stat === "string" || typeof scene.stat === "number") {
    scene.stat = { value: String(scene.stat), label: scene.headline };
    fixes.push({
      path: `${path}.stat`,
      rule: "expand-stat",
      message: "Turned the stat text into { value, label }",
    });
  }
  if (scene.type === "stat" && scene.stat === undefined) {
    const source = [scene.headline, scene.body, scene.narration].filter(
      (v): v is string => typeof v === "string",
    );
    for (const text of source) {
      const found = /[$€£]?\d[\d.,]*\s?(?:%|x|k|m|b|×|hours?|h|ms|s)?/i.exec(
        text,
      );
      if (found) {
        const value = found[0].trim().slice(0, L.statValue);
        const label =
          squash(text.replace(found[0], "")).slice(0, L.statLabel) ||
          String(scene.headline ?? "");
        scene.stat = { value, label: label.slice(0, L.statLabel) };
        fixes.push({
          path: `${path}.stat`,
          rule: "derive-stat",
          message: `Took the stat "${value}" from the scene text`,
        });
        break;
      }
    }
  }
  if (isObj(scene.stat)) {
    const stat: Obj = { ...scene.stat };
    if (stat.value !== undefined) stat.value = str(stat.value);
    if (stat.label !== undefined) stat.label = str(stat.label);
    if (typeof stat.value === "string" && stat.value.length > L.statValue) {
      stat.value = stat.value.slice(0, L.statValue);
      fixes.push({
        path: `${path}.stat.value`,
        rule: "shorten-stat",
        message: "Shortened the stat value",
      });
    }
    if (typeof stat.label === "string" && stat.label.length > L.statLabel) {
      stat.label = cutAtBoundary(stat.label, L.statLabel);
      fixes.push({
        path: `${path}.stat.label`,
        rule: "shorten-stat",
        message: "Shortened the stat label",
      });
    }
    if (typeof stat.value === "string" && !/\d/.test(stat.value)) {
      warnings.push({
        path: `${path}.stat.value`,
        rule: "stat-without-number",
        message: `The stat "${stat.value}" contains no number`,
      });
    }
    scene.stat = stat;
  }

  // Chart.
  if (isObj(scene.chart)) {
    const chart: Obj = { ...scene.chart };
    if (chart.sourceAttribution !== undefined && chart.source === undefined) {
      chart.source = chart.sourceAttribution;
      fixes.push({
        path: `${path}.chart.source`,
        rule: "rename-field",
        message: 'Used "sourceAttribution" as "source"',
      });
    }
    if (Array.isArray(chart.data) && chart.labels === undefined) {
      const rows = chart.data.filter(isObj);
      chart.labels = rows.map((r) => str(r.label ?? r.name ?? r.x));
      chart.series = [
        {
          label: str(chart.title ?? scene.headline) ?? "Value",
          values: rows.map((r) => Number(r.value ?? r.y)),
        },
      ];
      fixes.push({
        path: `${path}.chart`,
        rule: "convert-chart",
        message: "Converted chart.data rows into labels and series",
      });
    }
    if (Array.isArray(chart.series)) {
      chart.series = chart.series.map((s) =>
        isObj(s)
          ? {
              ...s,
              label: str(s.label ?? s.name),
              values: Array.isArray(s.values ?? s.data)
                ? (s.values ?? s.data)
                : s.values,
            }
          : s,
      );
      for (const s of chart.series as Obj[]) {
        if (isObj(s)) {
          delete s.name;
          delete s.data;
          for (const key of Object.keys(s)) {
            if (!["label", "values", "unit"].includes(key)) delete s[key];
          }
        }
      }
    }
    for (const key of Object.keys(chart)) {
      if (!["labels", "series", "source"].includes(key)) delete chart[key];
    }
    scene.chart = chart;
  }

  // Quote and code shapes.
  if (isObj(scene.quote)) {
    const quote: Obj = { ...scene.quote };
    if (quote.attribution === undefined) {
      const alias = quote.author ?? quote.source ?? quote.speaker ?? quote.by;
      if (alias !== undefined) {
        quote.attribution = alias;
        fixes.push({
          path: `${path}.quote.attribution`,
          rule: "rename-field",
          message: "Used the quote author as attribution",
        });
      }
    }
    for (const key of Object.keys(quote)) {
      if (!["text", "attribution"].includes(key)) delete quote[key];
    }
    scene.quote = quote;
  }
  if (typeof scene.code === "string") {
    scene.code = { language: "text", text: scene.code };
    fixes.push({
      path: `${path}.code`,
      rule: "expand-code",
      message: 'Turned the code text into { language: "text", text }',
    });
  } else if (
    isObj(scene.code) &&
    scene.code.text === undefined &&
    typeof scene.code.snippet === "string"
  ) {
    scene.code = { language: scene.code.language, text: scene.code.snippet };
    fixes.push({
      path: `${path}.code`,
      rule: "rename-field",
      message: 'Used "snippet" as "text"',
    });
  }

  // Media.
  if (typeof scene.media === "string") {
    scene.media = { query: scene.media };
    fixes.push({
      path: `${path}.media`,
      rule: "expand-media",
      message: "Turned the media text into { query }",
    });
  } else if (isObj(scene.media)) {
    const media: Obj = {};
    const order = ["assetId", "path", "query"];
    const present = order.filter(
      (k) =>
        typeof scene.media !== "undefined" &&
        (scene.media as Obj)[k] !== undefined,
    );
    const queryAlias = [
      "description",
      "prompt",
      "search",
      "keywords",
      "keyword",
      "alt",
    ].find(
      (k) =>
        typeof (scene.media as Obj)[k] === "string" &&
        ((scene.media as Obj)[k] as string).trim().length >= 2,
    );
    if (present.length === 0 && queryAlias) {
      media.query = cutAtBoundary(
        (scene.media as Obj)[queryAlias] as string,
        L.mediaQuery,
      );
      fixes.push({
        path: `${path}.media`,
        rule: "rename-field",
        message: `Used "${queryAlias}" as "query"`,
      });
    } else if (
      present.length === 0 &&
      typeof scene.headline === "string" &&
      scene.headline.length >= 2
    ) {
      media.query = cutAtBoundary(scene.headline, L.mediaQuery);
      fixes.push({
        path: `${path}.media`,
        rule: "derive-media-query",
        message:
          "The media had no query, assetId or path; used the headline as the search query",
      });
    } else if (present.length > 0) {
      media[present[0]!] = (scene.media as Obj)[present[0]!];
      if (present.length > 1) {
        fixes.push({
          path: `${path}.media`,
          rule: "single-media-source",
          message: `Kept "${present[0]}" and dropped ${present.slice(1).join(", ")}`,
        });
      }
    }
    scene.media = Object.keys(media).length > 0 ? media : scene.media;
  }

  // Icon, emphasis, duration.
  if (typeof scene.icon === "string") {
    const icon = slugify(scene.icon);
    if (icon !== scene.icon) {
      fixes.push({
        path: `${path}.icon`,
        rule: "normalize-icon",
        message: `Normalized icon "${scene.icon}"`,
      });
    }
    if (icon) scene.icon = icon;
    else delete scene.icon;
  }
  if (typeof scene.emphasis === "string") {
    scene.emphasis = [scene.emphasis];
    fixes.push({
      path: `${path}.emphasis`,
      rule: "wrap-array",
      message: "Wrapped emphasis in a list",
    });
  }
  if (Array.isArray(scene.emphasis)) {
    const words = scene.emphasis
      .map(str)
      .filter((w): w is string => Boolean(w))
      .map((w) => w.slice(0, L.emphasisWord));
    if (words.length > L.emphasisCount) {
      fixes.push({
        path: `${path}.emphasis`,
        rule: "clamp-emphasis",
        message: `Kept the first ${L.emphasisCount} emphasis words`,
      });
    }
    scene.emphasis = words.slice(0, L.emphasisCount);
    if ((scene.emphasis as string[]).length === 0) delete scene.emphasis;
  }
  if (scene.durationHint !== undefined) {
    const n =
      typeof scene.durationHint === "string"
        ? parseFloat(scene.durationHint)
        : scene.durationHint;
    if (typeof n === "number" && Number.isFinite(n)) {
      const clamped = Math.min(
        L.durationHint.max,
        Math.max(L.durationHint.min, n),
      );
      if (clamped !== scene.durationHint) {
        fixes.push({
          path: `${path}.durationHint`,
          rule: "clamp-duration",
          message: `Set durationHint to ${clamped}`,
        });
      }
      scene.durationHint = clamped;
    }
  }

  drop(scene, SCENE_KEYS, path, fixes);
  return scene;
}

function repairRoot(
  raw: Obj,
  options: LintOptions,
  fixes: LintFix[],
  warnings: LintWarning[],
): Obj {
  const root: Obj = { ...raw };

  // Wrapper objects such as { storyboard: {...} }.
  if (
    isObj(root.storyboard) &&
    root.scenes === undefined &&
    root.turns === undefined
  ) {
    fixes.push({
      path: "storyboard",
      rule: "unwrap",
      message: 'Unwrapped the "storyboard" object',
    });
    return repairRoot(root.storyboard, options, fixes, warnings);
  }

  if (
    root.version === undefined ||
    root.version === "1" ||
    root.version === "1.0" ||
    root.version === 1.0
  ) {
    if (root.version !== 1) {
      root.version = 1;
      fixes.push({
        path: "version",
        rule: "fill-default",
        message: "Set version to 1",
      });
    }
  }

  if (
    root.kind === undefined &&
    (root.turns !== undefined ||
      root.speakers !== undefined ||
      root.dialogue !== undefined)
  ) {
    root.kind = "podcast";
    fixes.push({
      path: "kind",
      rule: "infer-kind",
      message: 'Inferred kind "podcast"',
    });
  }
  if (typeof root.kind === "string")
    root.kind = squash(root.kind).toLowerCase();
  const podcast = root.kind === "podcast";

  if (typeof root.title === "string") {
    root.title = squash(root.title);
    if ((root.title as string).length > L.title) {
      root.title = cutAtBoundary(root.title as string, L.title);
      fixes.push({
        path: "title",
        rule: "shorten-title",
        message: "Shortened the title",
      });
    }
  }

  if (!podcast) {
    if (
      root.format === undefined &&
      (root.aspectRatio ?? root.aspect_ratio ?? root.orientation) !== undefined
    ) {
      root.format = root.aspectRatio ?? root.aspect_ratio ?? root.orientation;
      fixes.push({
        path: "format",
        rule: "rename-field",
        message: "Used the aspect ratio field as format",
      });
    }
    if (typeof root.format === "string") {
      const key = squash(root.format).toLowerCase();
      const mapped =
        FORMAT_ALIASES[key] ??
        FORMAT_ALIASES[key.replace(/\s*\(.*\)$/, "").trim()];
      const leading = /^(\d+)\s*[:x/]\s*(\d+)/.exec(key);
      const viaRatio = leading
        ? FORMAT_ALIASES[`${leading[1]}:${leading[2]}`]
        : undefined;
      const target = mapped ?? viaRatio;
      if (target) {
        if (target !== root.format) {
          fixes.push({
            path: "format",
            rule: "map-enum",
            message: `Mapped format "${root.format}" to "${target}"`,
          });
        }
        root.format = target;
      }
    }
    if (isObj(root.captions)) {
      const on =
        root.captions.enabled !== false && root.captions.enabled !== "false";
      fixes.push({
        path: "captions",
        rule: "map-enum",
        message: `Mapped the captions settings to "${on ? "auto" : "off"}"`,
      });
      root.captions = on ? "auto" : "off";
    }
    if (
      typeof root.captions === "boolean" ||
      typeof root.captions === "string"
    ) {
      const v = String(root.captions).toLowerCase();
      const mapped = ["true", "on", "yes", "auto", "enabled"].includes(v)
        ? "auto"
        : ["false", "off", "no", "none", "disabled"].includes(v)
          ? "off"
          : undefined;
      if (mapped && mapped !== root.captions) {
        fixes.push({
          path: "captions",
          rule: "map-enum",
          message: `Mapped captions "${String(root.captions)}" to "${mapped}"`,
        });
        root.captions = mapped;
      }
    }
    if (typeof root.voice === "boolean") {
      root.voice = { enabled: root.voice };
      fixes.push({
        path: "voice",
        rule: "expand-voice",
        message: "Turned the voice flag into { enabled }",
      });
    } else if (typeof root.voice === "string") {
      root.voice = { enabled: true, voiceId: squash(root.voice) };
      fixes.push({
        path: "voice",
        rule: "expand-voice",
        message: "Turned the voice name into { enabled, voiceId }",
      });
    } else if (isObj(root.voice)) {
      const voice: Obj = { ...root.voice };
      if (typeof voice.speed === "number") {
        const clamped = Math.min(1.3, Math.max(0.7, voice.speed));
        if (clamped !== voice.speed) {
          fixes.push({
            path: "voice.speed",
            rule: "clamp-speed",
            message: `Set speed to ${clamped}`,
          });
          voice.speed = clamped;
        }
      }
      for (const key of Object.keys(voice)) {
        if (!["enabled", "voiceId", "speed"].includes(key)) {
          delete voice[key];
          fixes.push({
            path: `voice.${key}`,
            rule: "drop-unknown-field",
            message: `Removed unknown field "${key}"`,
          });
        }
      }
      root.voice = voice;
    }
  }

  if (root.music !== undefined) {
    if (typeof root.music === "boolean") {
      root.music = root.music ? "auto" : "none";
      fixes.push({
        path: "music",
        rule: "map-enum",
        message: `Mapped music flag to "${String(root.music)}"`,
      });
    } else if (typeof root.music === "string") {
      const v = squash(root.music).toLowerCase();
      let mapped = v;
      if (["off", "silent", "silence", "no", "false", "none", ""].includes(v))
        mapped = "none";
      else if (["on", "yes", "true", "default", "background"].includes(v))
        mapped = "auto";
      else if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(v)) mapped = "auto";
      if (mapped !== root.music) {
        fixes.push({
          path: "music",
          rule: "map-enum",
          message: `Mapped music "${root.music}" to "${mapped}"`,
        });
      }
      root.music = mapped;
    } else {
      root.music = "auto";
      fixes.push({
        path: "music",
        rule: "fill-default",
        message: 'Set music to "auto"',
      });
    }
  }
  if (typeof root.theme === "string") {
    const theme = slugify(root.theme);
    if (theme !== root.theme) {
      fixes.push({
        path: "theme",
        rule: "normalize-theme",
        message: `Normalized theme "${root.theme}"`,
      });
    }
    if (theme) root.theme = theme;
    else delete root.theme;
  }

  if (Array.isArray(root.sources)) {
    const today = options.today ?? new Date().toISOString().slice(0, 10);
    const sources: unknown[] = [];
    for (const [i, s] of root.sources.entries()) {
      if (!isObj(s)) continue;
      const source: Obj = { ...s };
      if (source.title === undefined && typeof source.name === "string")
        source.title = source.name;
      if (source.url === undefined && typeof source.link === "string")
        source.url = source.link;
      if (
        typeof source.url !== "string" ||
        !/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(source.url)
      ) {
        fixes.push({
          path: `sources.${i}`,
          rule: "drop-source",
          message: "Dropped a source without a valid http(s) URL",
        });
        continue;
      }
      if (source.title === undefined)
        source.title = new URL(source.url).hostname;
      if (typeof source.title === "string")
        source.title = cutAtBoundary(source.title, L.sourceTitle);
      if (
        typeof source.accessed !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(source.accessed)
      ) {
        const iso =
          typeof source.accessed === "string"
            ? /^(\d{4}-\d{2}-\d{2})/.exec(source.accessed)?.[1]
            : undefined;
        source.accessed = iso ?? today;
        fixes.push({
          path: `sources.${i}.accessed`,
          rule: "fill-default",
          message: `Set accessed to ${String(source.accessed)}`,
        });
      }
      for (const key of Object.keys(source)) {
        if (!["title", "url", "accessed"].includes(key)) delete source[key];
      }
      sources.push(source);
    }
    if (sources.length > L.sources) {
      fixes.push({
        path: "sources",
        rule: "clamp-sources",
        message: `Kept the first ${L.sources} sources`,
      });
    }
    root.sources = sources.slice(0, L.sources);
    if ((root.sources as unknown[]).length === 0) delete root.sources;
  }

  if (podcast) repairPodcast(root, fixes, warnings);
  else {
    if (Array.isArray(root.scenes)) {
      if (root.scenes.length > L.scenes.max) {
        fixes.push({
          path: "scenes",
          rule: "clamp-scenes",
          message: `Kept the first ${L.scenes.max} of ${root.scenes.length} scenes`,
        });
        root.scenes = root.scenes.slice(0, L.scenes.max);
      }
      root.scenes = (root.scenes as unknown[]).map((s, i) =>
        repairScene(s, `scenes.${i}`, fixes, warnings),
      );
    }
    if (
      root.title === undefined &&
      Array.isArray(root.scenes) &&
      isObj(root.scenes[0]) &&
      typeof root.scenes[0].headline === "string"
    ) {
      root.title = cutAtBoundary(root.scenes[0].headline as string, L.title);
      fixes.push({
        path: "title",
        rule: "derive-title",
        message: "Used the first headline as the title",
      });
    }
  }

  drop(root, ROOT_KEYS[podcast ? "podcast" : "video"], "", fixes);
  return root;
}

function repairPodcast(
  root: Obj,
  fixes: LintFix[],
  warnings: LintWarning[],
): void {
  void warnings;
  if (root.speakers === undefined && Array.isArray(root.hosts)) {
    root.speakers = root.hosts;
    delete root.hosts;
    fixes.push({
      path: "speakers",
      rule: "rename-field",
      message: 'Used "hosts" as "speakers"',
    });
  }
  if (root.turns === undefined) {
    const alias = ["dialogue", "script", "lines", "conversation"].find((k) =>
      Array.isArray(root[k]),
    );
    if (alias) {
      root.turns = root[alias];
      delete root[alias];
      fixes.push({
        path: "turns",
        rule: "rename-field",
        message: `Used "${alias}" as "turns"`,
      });
    }
  }
  const idByName = new Map<string, string>();
  if (Array.isArray(root.speakers)) {
    const used = new Set<string>();
    root.speakers = root.speakers.map((s, i) => {
      const speaker: Obj =
        typeof s === "string" ? { name: s } : isObj(s) ? { ...s } : {};
      const name = str(speaker.name);
      if (name !== undefined) speaker.name = name;
      if (speaker.id === undefined && name) {
        let id = slugify(name) || `speaker-${i + 1}`;
        if (!/^[a-z]/.test(id)) id = `s-${id}`;
        id = id.slice(0, 20);
        while (used.has(id)) id = `${id.slice(0, 17)}-${i}`;
        speaker.id = id;
        fixes.push({
          path: `speakers.${i}.id`,
          rule: "derive-id",
          message: `Derived speaker id "${id}" from the name`,
        });
      }
      if (typeof speaker.id === "string") {
        used.add(speaker.id);
        if (name) idByName.set(name.toLowerCase(), speaker.id);
        idByName.set(speaker.id.toLowerCase(), speaker.id);
      }
      for (const key of Object.keys(speaker)) {
        if (!["id", "name", "voiceId"].includes(key)) delete speaker[key];
      }
      return speaker;
    });
  }
  if (Array.isArray(root.turns)) {
    if (root.turns.length > L.turns.max) {
      fixes.push({
        path: "turns",
        rule: "clamp-turns",
        message: `Kept the first ${L.turns.max} turns`,
      });
      root.turns = root.turns.slice(0, L.turns.max);
    }
    root.turns = (root.turns as unknown[]).map((t, i) => {
      if (!isObj(t)) return t;
      const turn: Obj = { ...t };
      if (turn.text === undefined) {
        const alias = ["line", "content", "speech", "dialogue", "message"].find(
          (k) => typeof turn[k] === "string",
        );
        if (alias) {
          turn.text = turn[alias];
          fixes.push({
            path: `turns.${i}.text`,
            rule: "rename-field",
            message: `Used "${alias}" as "text"`,
          });
        }
      }
      if (turn.speaker === undefined && typeof turn.name === "string")
        turn.speaker = turn.name;
      if (typeof turn.speaker === "string") {
        const id = idByName.get(squash(turn.speaker).toLowerCase());
        if (id && id !== turn.speaker) {
          fixes.push({
            path: `turns.${i}.speaker`,
            rule: "map-speaker",
            message: `Mapped speaker "${turn.speaker}" to id "${id}"`,
          });
          turn.speaker = id;
        }
      }
      if (typeof turn.text === "string") {
        turn.text = squash(turn.text);
        if ((turn.text as string).length > L.turnText) {
          fixes.push({
            path: `turns.${i}.text`,
            rule: "shorten-turn",
            message: "Cut an overlong turn at a sentence boundary",
          });
          turn.text = cutAtBoundary(turn.text as string, L.turnText);
        }
      }
      for (const key of Object.keys(turn)) {
        if (!["speaker", "text"].includes(key)) delete turn[key];
      }
      return turn;
    });
  }
}

const EXAMPLES: [RegExp, string, string][] = [
  [/^title$/, "a title of 1 to 80 characters", '"Why sleep is a skill"'],
  [
    /\.headline$/,
    `an on-screen phrase of 1 to ${L.headline} characters`,
    '"Sleep is a skill"',
  ],
  [
    /\.narration$/,
    `spoken sentences of 1 to ${L.narration} characters`,
    '"Most adults need seven to nine hours."',
  ],
  [
    /\.items$/,
    `${L.itemCount.min} to ${L.itemCount.max} items of at most ${L.item} characters`,
    '["Same bedtime", "No screens"]',
  ],
  [
    /\.stat(\.|$)/,
    `{ value (max ${L.statValue} chars), label (max ${L.statLabel} chars) }`,
    '{ "value": "73%", "label": "report better focus" }',
  ],
  [
    /\.chart(\.|$)/,
    `${L.chartLabels.min}-${L.chartLabels.max} labels and series with one number per label`,
    '{ "labels": ["2024", "2025"], "series": [{ "label": "Users", "values": [10, 14] }] }',
  ],
  [
    /\.quote(\.|$)/,
    "{ text, attribution }",
    '{ "text": "Plain words.", "attribution": "A. Writer" }',
  ],
  [
    /\.code(\.|$)/,
    `{ language, text } with at most ${L.codeLines} lines`,
    '{ "language": "typescript", "text": "const a = 1;" }',
  ],
  [
    /\.media(\.|$)/,
    "exactly one of query, assetId or path",
    '{ "query": "sunrise over a city street" }',
  ],
  [/\.type$/, `one of ${SCENE_TYPES.join(", ")}`, '"statement"'],
  [
    /^scenes$/,
    `${L.scenes.min} to ${L.scenes.max} scenes`,
    '[{ "type": "hook", "headline": "...", "narration": "..." }]',
  ],
  [/^format$/, FORMATS.join(", "), '"9:16"'],
  [/^version$/, "the number 1", "1"],
  [
    /^speakers/,
    `${L.speakers.min} to ${L.speakers.max} speakers with id and name`,
    '[{ "id": "host", "name": "Maya" }]',
  ],
  [
    /^turns/,
    `${L.turns.min} to ${L.turns.max} turns { speaker, text }`,
    '{ "speaker": "host", "text": "Welcome." }',
  ],
  [
    /^sources/,
    "{ title, url (http/https), accessed (YYYY-MM-DD) }",
    '{ "title": "Guide", "url": "https://example.com", "accessed": "2026-11-13" }',
  ],
];

function hint(path: string): { expected: string; example: string } {
  const stripped = path.replace(/\.\d+(?=\.|$)/g, "");
  for (const [pattern, expected, example] of EXAMPLES) {
    if (pattern.test(stripped)) return { expected, example };
  }
  return {
    expected: "a value that matches the Storyboard v1 schema",
    example: "see schemas/storyboard.v1.json",
  };
}

function zodToErrors(error: ZodError): LintError[] {
  const seen = new Set<string>();
  const out: LintError[] = [];
  for (const issue of error.issues) {
    // Unions report children; use the deepest path.
    const path = issue.path.join(".");
    const key = `${path}|${issue.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const { expected, example } = hint(path);
    out.push({ path, message: issue.message, expected, example });
  }
  return out;
}

function addWarnings(
  storyboard: Storyboard,
  options: LintOptions,
  warnings: LintWarning[],
) {
  if (storyboard.kind === "video") {
    const scenes = storyboard.scenes;
    for (const [i, s] of scenes.entries()) {
      if (norm(s.headline) === norm(s.narration)) {
        warnings.push({
          path: `scenes.${i}`,
          rule: "headline-equals-narration",
          message:
            "The headline repeats the narration word for word; the on-screen text should be shorter than what is said",
        });
      }
      const words = countWords(s.narration);
      if (words < 3 || words > 40) {
        warnings.push({
          path: `scenes.${i}.narration`,
          rule: "narration-length",
          message: `Narration is ${words} words; aim for 3 to 40 per scene`,
        });
      }
      if (s.type === "stat" && !/\d/.test(s.stat?.value ?? "")) {
        warnings.push({
          path: `scenes.${i}.stat.value`,
          rule: "stat-without-number",
          message: "A stat scene should show a number",
        });
      }
    }
    let run = 1;
    for (let i = 1; i < scenes.length; i++) {
      run = scenes[i]!.type === scenes[i - 1]!.type ? run + 1 : 1;
      if (run === 3) {
        warnings.push({
          path: `scenes.${i}.type`,
          rule: "repeated-type",
          message: `Three or more "${scenes[i]!.type}" scenes in a row; vary the scene types`,
        });
      }
    }
    if (scenes[0]!.type !== "hook") {
      warnings.push({
        path: "scenes.0.type",
        rule: "no-hook",
        message: "Scene one should be a hook",
      });
    }
    const last = scenes[scenes.length - 1]!;
    if (last.type !== "cta" && last.type !== "statement") {
      warnings.push({
        path: `scenes.${scenes.length - 1}.type`,
        rule: "no-closing",
        message: "End with a cta or a statement that closes the idea",
      });
    }
  }
  const seconds = estimateDurationSeconds(storyboard);
  if (options.minSeconds !== undefined && seconds < options.minSeconds) {
    warnings.push({
      path: "",
      rule: "duration",
      message: `Estimated ${Math.round(seconds)} s is shorter than the requested ${options.minSeconds} s`,
    });
  }
  if (options.maxSeconds !== undefined && seconds > options.maxSeconds) {
    warnings.push({
      path: "",
      rule: "duration",
      message: `Estimated ${Math.round(seconds)} s is longer than the requested ${options.maxSeconds} s`,
    });
  }
}

export function lintStoryboard(
  input: unknown,
  options: LintOptions = {},
): LintResult {
  const fixes: LintFix[] = [];
  const warnings: LintWarning[] = [];
  const fail = (errors: LintError[]): LintResult => ({
    storyboard: null,
    fixes,
    warnings,
    errors,
  });

  let value = input;
  if (typeof input === "string") {
    try {
      value = extractJson(input, fixes);
    } catch (error) {
      return fail([
        {
          path: "",
          message: error instanceof Error ? error.message : "Not valid JSON",
          expected: "one JSON object",
          example: '{ "version": 1, "title": "...", "scenes": [ ... ] }',
        },
      ]);
    }
  }
  if (!isObj(value)) {
    return fail([
      {
        path: "",
        message: "A storyboard must be a JSON object",
        expected: "one JSON object",
        example: '{ "version": 1, "title": "...", "scenes": [ ... ] }',
      },
    ]);
  }

  const repaired = repairRoot(value, options, fixes, warnings);
  try {
    const storyboard = parseStoryboard(repaired);
    addWarnings(storyboard, options, warnings);
    return { storyboard, fixes, warnings, errors: [] };
  } catch (error) {
    if (error instanceof ZodError) return fail(zodToErrors(error));
    throw error;
  }
}
