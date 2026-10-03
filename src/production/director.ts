import type { AIScene } from "@/providers/ai/types";
import type { ProductionSceneRole } from "./roles";
import { motionFallbackReason } from "./motion";
import type { ShotDirection } from "@/video/shot-direction";

export type BeatKind =
  "prose" | "metric" | "chart" | "list" | "quote" | "comparison";
const METRIC_PATTERN =
  /(?:[$€£]\s*\d+(?:[.,]\d+)*|\d+(?:[.,]\d+)*\s*(?:%|×|x\b))/gi;

export function sourcePlanSeed(text: string): string {
  let hash = 2166136261;
  for (const character of text.normalize("NFC"))
    hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619);
  return `director-${(hash >>> 0).toString(16)}`;
}

/** Recognize only explicit supplied structures; never estimate chart values. */
export function analyzeBeat(text: string) {
  const rows = text
    .trim()
    .split(/\n|;/)
    .map((row) => row.trim())
    .filter(Boolean);
  const pairs = rows.map((row) =>
    /^([^:]{1,24}):\s*(\d+(?:\.\d+)?)\s*(%)?\s*$/.exec(row),
  );
  if (
    rows.length >= 2 &&
    rows.length <= 6 &&
    pairs.every(Boolean) &&
    pairs.every((pair) => pair![3] === pairs[0]![3])
  ) {
    return {
      kind: "chart" as BeatKind,
      chart: {
        labels: pairs.map((pair) => pair![1].trim()),
        series: [
          {
            label: "Supplied values",
            values: pairs.map((pair) => Number(pair![2])),
            ...(pairs[0]![3] ? { unit: "%" } : {}),
          },
        ],
      },
      emphasis: [] as string[],
    };
  }
  const items = rows.map((row) => row.replace(/^(?:[-*•]|\d+[.)])\s+/, ""));
  if (
    items.length >= 2 &&
    items.length <= 5 &&
    items.every((item) => item.length <= 80) &&
    (rows.every((row) => /^(?:[-*•]|\d+[.)])\s+/.test(row)) ||
      text.includes(";"))
  ) {
    return { kind: "list" as BeatKind, items, emphasis: [] as string[] };
  }
  const comparison = /^(.{1,80}?)\s+(?:vs\.?|versus)\s+(.{1,80}?)[.!]?$/i.exec(
    text.trim(),
  );
  if (comparison)
    return {
      kind: "comparison" as BeatKind,
      items: [comparison[1].trim(), comparison[2].trim()],
      emphasis: [] as string[],
    };
  const quote = /[“"]([^”"\n]{3,240})[”"]/.exec(text);
  if (quote) return { kind: "quote" as BeatKind, emphasis: [quote[1]] };
  const metric = [...text.matchAll(METRIC_PATTERN)][0];
  if (metric)
    return {
      kind: "metric" as BeatKind,
      visual: metric[0],
      emphasis: [metric[0]],
    };
  return { kind: "prose" as BeatKind, emphasis: [] as string[] };
}

export function beatRole(
  kind: BeatKind,
  fallback: ProductionSceneRole,
): ProductionSceneRole {
  return (
    {
      metric: "metric",
      chart: "chart",
      list: "diagram",
      quote: "quote",
      comparison: "comparison",
      prose: fallback,
    } as const
  )[kind];
}

export function templateForBeat(kind: BeatKind): string | undefined {
  return {
    metric: "hf-stat",
    chart: "hf-data-chart",
    list: "hf-list",
    quote: "hf-quote",
    comparison: "hf-quote",
    prose: undefined,
  }[kind];
}

/** Numeric display data must be a literal supplied row/value, including units.
 * Repeated/mislabeled numbers do not prove a labeled dataset. */
export function groundSceneData(scene: AIScene, source: string): AIScene {
  const normalized = source.replace(/\s+/g, " ").toLowerCase();
  const contains = (value: string) =>
    normalized.includes(value.replace(/\s+/g, " ").toLowerCase());
  const sourceRows = source.split(/\n|;/).map((row) => row.trim());
  const chart =
    scene.chart &&
    scene.chart.series.length === 1 &&
    scene.chart.series.every(
      (series) =>
        (series.label === "Supplied values" || contains(series.label)) &&
        scene.chart!.labels.every((label, index) => {
          const value = series.values[index];
          const unit = series.unit ?? "";
          // Require an explicit label:value pair, not an unrelated matching number.
          return sourceRows.some((row) => {
            const pair = /^([^:]+):\s*(\d+(?:\.\d+)?)\s*(%)?\s*$/.exec(row);
            return (
              pair &&
              pair[1].trim().toLowerCase() === label.trim().toLowerCase() &&
              Number(pair[2]) === value &&
              (pair[3] ?? "") === unit
            );
          });
        }),
    ) &&
    (!scene.chart.sourceAttribution || contains(scene.chart.sourceAttribution))
      ? scene.chart
      : undefined;
  const visual =
    scene.visual &&
    /\d/.test(scene.visual) &&
    ![...source.matchAll(METRIC_PATTERN)].some(
      (match) => match[0] === scene.visual,
    )
      ? undefined
      : scene.visual;
  return { ...scene, chart, visual };
}

/** Shared director admission: an AI suggestion cannot create missing inputs. */
export function directScene(
  scene: AIScene,
  fallback: ProductionSceneRole,
  hasVisual = false,
): { scene: AIScene; role: ProductionSceneRole; direction: ShotDirection } {
  const beat = analyzeBeat(scene.spokenText ?? scene.text);
  const role = beatRole(beat.kind, fallback);
  const enriched: AIScene = {
    ...scene,
    emphasis: [...new Set([...scene.emphasis, ...beat.emphasis])].filter(
      (phrase) =>
        scene.text.includes(phrase) ||
        Boolean(scene.spokenText?.includes(phrase)),
    ),
    items: scene.items ?? beat.items,
    chart: scene.chart ?? beat.chart,
    visual: scene.visual ?? beat.visual,
    templateId: (templateForBeat(beat.kind) ??
      scene.templateId) as AIScene["templateId"],
  };
  const suggested = scene.direction;
  const composition =
    !hasVisual &&
    !enriched.visual &&
    !enriched.items &&
    !enriched.chart &&
    scene.text.length <= 240 &&
    (beat.kind === "quote" || suggested?.composition === "layered-title")
      ? "layered-title"
      : "authored";
  // Roles conveying factual structure come from actual content; prose suggestions
  // cannot turn an unlabelled number into a chart or an invented testimonial.
  const finalRole =
    beat.kind === "prose" &&
    suggested &&
    [
      "hook",
      "headline",
      "explanation",
      "emphasis",
      "summary",
      "cta",
      "payoff",
    ].includes(suggested.role)
      ? suggested.role
      : role;
  const motion =
    suggested?.motion &&
    !motionFallbackReason(
      suggested.motion,
      enriched.text,
      enriched.chart,
      Boolean(enriched.visual),
      enriched.items,
      hasVisual ? { type: "image", url: "supplied" } : undefined,
    )
      ? suggested.motion
      : undefined;
  const direction: ShotDirection = {
    version: 1,
    role: finalRole,
    composition,
    ...(motion ? { motion } : {}),
  };
  return { scene: { ...enriched, direction }, role: finalRole, direction };
}
