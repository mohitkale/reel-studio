/**
 * Project to Storyboard v1, the reverse of produceFromStoryboard.
 *
 * A project made from a storyboard keeps a small sidecar (`storyboardSource` in
 * the script's saved overrides) with the fields the scene model cannot hold: the
 * headline of a stat or quote scene, a stat label, a code language and the like.
 * They are applied back only while the scene's copy is unchanged, so edits made
 * in the editor always win. Projects without a sidecar export from the scene
 * model alone, mapping legacy templates onto the nine v1 scene types.
 */
import { createHash } from "node:crypto";

import type { SceneDTO, ScriptDTO } from "@/lib/dto";
import { MUSIC_LIBRARY } from "@/lib/music-library";
import { prisma } from "@/library/db";
import { getScript } from "@/library/repositories/scripts";
import { normalizeHfTemplateId } from "@/engines/hyperframes/templates";
import {
  lintStoryboard,
  STORYBOARD_LIMITS as L,
  type Storyboard,
} from "@/storyboard";

/** Scene template to storyboard type: the inverse of STORYBOARD_TEMPLATE_BY_TYPE. */
const TYPE_BY_TEMPLATE: Readonly<Record<string, string>> = {
  "hf-opener": "hook",
  "hf-statement": "statement",
  "hf-list": "list",
  "hf-stat": "stat",
  "hf-data-chart": "chart",
  "hf-quote": "quote",
  "hf-broll": "media",
  "hf-cta": "cta",
};

export interface SceneExtras {
  type: string;
  headline?: string;
  body?: string;
  icon?: string;
  durationHint?: number;
  statLabel?: string;
  quoteAttribution?: string;
  code?: { language: string; headline?: string };
  mediaQuery?: string;
}
export interface StoryboardSource {
  version: 1;
  root: {
    theme?: string;
    captions?: "auto" | "off";
    sources?: unknown[];
    voice?: unknown;
  };
  scenes: Array<{ fingerprint: string; extras: SceneExtras }>;
}

export function sceneFingerprint(
  text: string,
  spokenText?: string | null,
): string {
  return createHash("sha1")
    .update(`${text.trim()}\u0000${(spokenText ?? "").trim()}`)
    .digest("hex")
    .slice(0, 16);
}

export interface ProjectStoryboard {
  storyboard: Storyboard | null;
  /** What could not be carried over exactly, in plain words. */
  notes: string[];
  errors: Array<{
    path: string;
    message: string;
    expected: string;
    example: string;
  }>;
}

const hasDigit = (text: string | undefined) => /\d/.test(text ?? "");

function sceneToStoryboard(
  scene: SceneDTO,
  index: number,
  extras: SceneExtras | undefined,
  notes: string[],
): Record<string, unknown> {
  const template = normalizeHfTemplateId(scene.templateId);
  let type = extras?.type ?? TYPE_BY_TEMPLATE[template];
  if (!type) {
    type = "statement";
    notes.push(
      `scene ${index + 1}: template "${template}" is exported as a statement`,
    );
  }
  const spoken = (scene.spokenText ?? scene.text).trim();
  const out: Record<string, unknown> = { type };

  if (type === "quote") {
    out.headline = extras?.headline ?? scene.text;
    const attribution = extras?.quoteAttribution ?? scene.visual;
    if (attribution) out.quote = { text: scene.text, attribution };
    else {
      out.type = "statement";
      notes.push(
        `scene ${index + 1}: a quote without an attribution is exported as a statement`,
      );
    }
  } else if (type === "code" && extras?.code) {
    out.headline = extras.code.headline ?? "Code";
    out.code = { language: extras.code.language, text: scene.text };
  } else if (type === "stat") {
    out.headline = extras?.headline ?? scene.text;
    const value = scene.visual ?? "";
    if (value) out.stat = { value, label: extras?.statLabel ?? scene.text };
    else {
      out.type = "statement";
      notes.push(
        `scene ${index + 1}: a stat scene without a value is exported as a statement`,
      );
    }
  } else {
    out.headline = extras?.headline ?? scene.text;
  }
  out.narration = spoken;
  if (extras?.body) out.body = extras.body;
  else if (type === "cta" && scene.visual) out.body = scene.visual;
  if (type === "list" && scene.items?.length) out.items = scene.items;
  if (type === "chart") {
    const chart = scene.chart;
    const fits =
      chart &&
      chart.labels.length >= L.chartLabels.min &&
      chart.labels.length <= L.chartLabels.max &&
      chart.series.length <= L.chartSeries.max &&
      chart.series.every((s) => s.values.length === chart.labels.length);
    if (!fits) {
      out.type = "statement";
      notes.push(
        `scene ${index + 1}: a chart without usable data (2 to 6 labels, up to 3 series) is exported as a statement`,
      );
    }
  }
  if (out.type === "chart" && scene.chart) {
    out.chart = {
      labels: scene.chart.labels,
      series: scene.chart.series.map((s) => ({
        label: s.label,
        values: s.values,
        ...(s.unit ? { unit: s.unit } : {}),
      })),
      ...(scene.chart.sourceAttribution
        ? { source: scene.chart.sourceAttribution }
        : {}),
    };
  }
  if (type === "media") {
    const asset = scene.assetRefs?.[0];
    out.media = asset
      ? { assetId: asset }
      : { query: (extras?.mediaQuery ?? scene.text).slice(0, L.mediaQuery) };
  }
  if (scene.emphasis?.length)
    out.emphasis = scene.emphasis.slice(0, L.emphasisCount);
  if (extras?.icon) out.icon = extras.icon;
  if (extras?.durationHint) out.durationHint = extras.durationHint;
  return out;
}

/** Pure: build a storyboard from a loaded script. */
export function scriptToStoryboard(
  script: ScriptDTO & { storyboardSource?: StoryboardSource },
): ProjectStoryboard {
  const notes: string[] = [];
  const source = script.storyboardSource;
  const matches = (index: number, scene: SceneDTO) => {
    const saved = source?.scenes[index];
    return saved &&
      saved.fingerprint === sceneFingerprint(scene.text, scene.spokenText)
      ? saved.extras
      : undefined;
  };
  const scenes = script.scenes.map((scene, index) =>
    sceneToStoryboard(scene, index, matches(index, scene), notes),
  );
  if (source && script.scenes.some((scene, index) => !matches(index, scene))) {
    notes.push(
      "some scenes were edited after they were written; their extra details were dropped",
    );
  }

  const format =
    script.width > script.height
      ? "16:9"
      : script.width === script.height
        ? "1:1"
        : "9:16";
  const track = MUSIC_LIBRARY.find((t) => t.url === script.musicUrl);
  let music: string = "auto";
  if (!script.musicUrl) music = "none";
  else if (track) music = track.id;
  else
    notes.push(
      "the background music is a custom file and is exported as automatic music",
    );

  const raw: Record<string, unknown> = {
    version: 1,
    title: script.name,
    format,
    ...(source?.root.theme ? { theme: source.root.theme } : {}),
    music,
    captions: source?.root.captions ?? "auto",
    ...(source?.root.sources ? { sources: source.root.sources } : {}),
    scenes,
  };
  if (source?.root.voice) raw.voice = source.root.voice;

  const linted = lintStoryboard(raw);
  for (const fix of linted.fixes)
    notes.push(`${fix.path || "root"}: ${fix.message}`);
  for (const warning of linted.warnings) {
    if (!hasDigit(warning.path) || warning.rule === "stat-without-number")
      notes.push(warning.message);
  }
  return { storyboard: linted.storyboard, notes, errors: linted.errors };
}

export async function projectToStoryboard(
  scriptId: string,
): Promise<ProjectStoryboard | null> {
  const script = await getScript(scriptId);
  if (!script) return null;
  const row = await prisma.script.findUnique({
    where: { id: scriptId },
    select: { brandOverrides: true },
  });
  let storyboardSource: StoryboardSource | undefined;
  try {
    const parsed = JSON.parse(row?.brandOverrides ?? "{}") as {
      storyboardSource?: StoryboardSource;
    };
    if (parsed.storyboardSource?.version === 1)
      storyboardSource = parsed.storyboardSource;
  } catch {
    // An unreadable column exports from the scene model alone.
  }
  return scriptToStoryboard({ ...script, storyboardSource });
}

/** The sidecar saved with a project made from a storyboard (see the header). */
export function buildStoryboardSource(
  storyboard: Extract<Storyboard, { kind: "video" }>,
  scenes: Array<{ text: string; spokenText?: string | null }>,
): StoryboardSource {
  return {
    version: 1,
    root: {
      ...(storyboard.theme ? { theme: storyboard.theme } : {}),
      captions: storyboard.captions,
      ...(storyboard.sources ? { sources: storyboard.sources } : {}),
      ...(storyboard.voice ? { voice: storyboard.voice } : {}),
    },
    scenes: storyboard.scenes.map((scene, index) => {
      const planned = scenes[index]!;
      const extras: SceneExtras = {
        type: scene.type,
        headline: scene.headline,
        ...(scene.body ? { body: scene.body } : {}),
        ...(scene.icon ? { icon: scene.icon } : {}),
        ...(scene.durationHint ? { durationHint: scene.durationHint } : {}),
        ...(scene.stat ? { statLabel: scene.stat.label } : {}),
        ...(scene.quote ? { quoteAttribution: scene.quote.attribution } : {}),
        ...(scene.code
          ? {
              code: { language: scene.code.language, headline: scene.headline },
            }
          : {}),
        ...(scene.media?.query ? { mediaQuery: scene.media.query } : {}),
      };
      return {
        fingerprint: sceneFingerprint(planned.text, planned.spokenText),
        extras,
      };
    }),
  };
}
