import {
  ADAPTIVE_RECIPES,
  isAdaptiveRecipe,
  type AdaptiveRecipeId,
} from "@/video/adaptive-catalog";
import type { AdaptiveLayout } from "@/video/adaptive-layout";
import type { ReelScene, SceneChartData, SceneBackground } from "@/video/types";
import { resolveProductionLayout } from "./layout";

type Content = {
  text: string;
  items?: string[];
  chart?: Pick<SceneChartData, "labels" | "series" | "sourceAttribution">;
  background?: Pick<SceneBackground, "type" | "url">;
  visual?: string;
  hideText?: boolean;
  direction?: { graphic?: unknown };
};
/** Shared admission checks for manual controls, planning and rendering. Never discard content. */
export function adaptiveInputReason(
  id: AdaptiveRecipeId,
  scene: Content,
): string | undefined {
  const recipe = ADAPTIVE_RECIPES.find((r) => r.id === id)!;
  if (scene.direction?.graphic)
    return "This scene has a saved illustration; this recipe cannot hide its subjects or relationships.";
  if (scene.hideText) return "Text is hidden for this scene.";
  if (
    !scene.text.trim() ||
    Array.from(scene.text).length > recipe.maxCharacters
  )
    return `Supply 1–${recipe.maxCharacters} characters of headline copy.`;
  if (scene.visual)
    return "Keep the existing visual; this recipe cannot replace it.";
  const list = id === "adaptive-comparison" || id === "adaptive-process";
  if (list) {
    const max = id === "adaptive-comparison" ? 4 : 6;
    if (
      !scene.items ||
      scene.items.length < 2 ||
      scene.items.length > max ||
      scene.items.some((s) => !s.trim() || Array.from(s).length > 96)
    )
      return `Supply 2–${max} ${id === "adaptive-process" ? "ordered steps" : "alternatives"}, each up to 96 characters.`;
  } else if (scene.items?.length)
    return "This recipe cannot hide supplied list items.";
  if (id === "adaptive-evidence") {
    const chart = scene.chart,
      series = chart?.series[0];
    if (
      !chart ||
      chart.series.length !== 1 ||
      !series ||
      !chart.labels.length ||
      chart.labels.length > 6 ||
      chart.labels.length !== series.values.length
    )
      return "Supply one series with 1–6 matching labels and values.";
    if (
      chart.labels.some((s) => !s.trim() || Array.from(s).length > 48) ||
      series.values.some(
        (n) => !Number.isFinite(n) || n < 0 || String(n).length > 14,
      )
    )
      return "Use labels up to 48 characters and finite nonnegative values up to 14 characters.";
    if (
      (series.unit?.length ?? 0) > 12 ||
      series.label.length > 60 ||
      (chart.sourceAttribution?.length ?? 0) > 160
    )
      return "Shorten the unit, series label or attribution to fit the evidence canvas.";
  } else if (scene.chart) return "This recipe cannot hide supplied chart data.";
  if (id === "adaptive-media") {
    if (!scene.background?.url || scene.background.type !== "image")
      return "Supply an image. Video keeps its existing media treatment.";
  } else if (scene.background?.url)
    return "This recipe cannot hide supplied media.";
}

/** Conservative deterministic fit; runtime never measures or truncates source copy. */
export function fitAdaptiveText(
  text: string,
  width: number,
  height: number,
  max: number,
  min: number,
): number | undefined {
  const lineUnits = text
    .split(/\r\n|\r|\n/)
    .map((line) =>
      Array.from(line).reduce(
        (n, c) => n + (/[^\u0000-\u024f]/.test(c) ? 1 : 0.66),
        0,
      ),
    );
  for (let size = Math.floor(max); size >= Math.ceil(min); size--) {
    const lines = lineUnits.reduce(
      (n, units) =>
        n + Math.max(1, Math.ceil(units / Math.max(1, width / size - 1))),
      0,
    );
    // Reserve a line for word wrapping; overflow-wrap handles long unbroken text.
    if ((lines + 1) * size * 1.22 <= height) return size;
  }
}
export function resolveAdaptiveLayout(
  scene: ReelScene,
  width: number,
  height: number,
  duration: number,
): { plan?: AdaptiveLayout; reason?: string } {
  const id = scene.motion?.recipeId;
  if (!isAdaptiveRecipe(id)) return {};
  const reason = adaptiveInputReason(id, scene);
  if (reason) return { reason };
  if (!Number.isFinite(duration) || duration < 1 || duration > 120)
    return {
      reason:
        "Adaptive scenes support 1–120 seconds; the saved layout is retained.",
    };
  const { safeArea, orientation } = resolveProductionLayout({ width, height });
  const x = safeArea.left,
    y = safeArea.top,
    w = width - safeArea.left - safeArea.right,
    h = height - safeArea.top - safeArea.bottom;
  const scale = Math.min(width, height) / 1080,
    gap = 28 * scale,
    pad = 28 * scale;
  const system = scene.motion?.system ?? "precision";
  const count = scene.items?.length ?? scene.chart?.labels.length ?? 1;
  const dense =
    (scene.items ?? scene.chart?.labels ?? []).join("").length > 140 ||
    scene.text.length > 130;
  let variant: AdaptiveLayout["variant"] = "focus";
  let head = { x, y, width: w, height: h * 0.22, fontSize: 0 };
  let area = { x, y: y + h * 0.27, width: w, height: h * 0.73 };
  let cols = 1;
  if (id === "adaptive-concept" || id === "adaptive-editorial") {
    variant = id === "adaptive-concept" ? "focus" : "reading";
    head = {
      x: x + pad,
      y: y + h * 0.12,
      width: w - pad * 2,
      height: h * 0.72,
      fontSize: 0,
    };
  } else if (id === "adaptive-media") {
    const side = orientation === "landscape" && !dense;
    variant = side ? "media-side" : "media-stack";
    head = side
      ? {
          x: x + w * 0.65,
          y: y + h * 0.15,
          width: w * 0.35,
          height: h * 0.7,
          fontSize: 0,
        }
      : { x, y: y + h * 0.72, width: w, height: h * 0.28, fontSize: 0 };
    area = side
      ? { x, y, width: w * 0.6, height: h }
      : { x, y, width: w, height: h * 0.66 };
  } else if (id === "adaptive-comparison") {
    cols =
      orientation === "portrait"
        ? count === 4 && !dense
          ? 2
          : 1
        : orientation === "square"
          ? count === 3 || dense
            ? 1
            : 2
          : count <= 3 && !dense
            ? count
            : 2;
    variant =
      cols === 1 ? "stack" : Math.ceil(count / cols) > 1 ? "grid" : "columns";
  } else if (id === "adaptive-process") {
    cols =
      orientation === "landscape"
        ? count > 4
          ? 3
          : dense
            ? 2
            : count
        : orientation === "square" && count > 3
          ? 2
          : 1;
    variant = cols > 1 ? "route" : "stack";
  } else {
    cols = count > 3 && orientation !== "portrait" ? 2 : 1;
    variant =
      count === 1
        ? "metric"
        : orientation === "landscape" && !dense
          ? "bars"
          : "ledger";
    area.height -= h * 0.13;
  }
  const headMax =
    (id === "adaptive-concept" ? 96 : id === "adaptive-editorial" ? 72 : 56) *
    scale;
  const headFont = fitAdaptiveText(
    scene.text,
    head.width,
    head.height,
    headMax,
    28 * scale,
  );
  if (!headFont)
    return {
      reason:
        "The complete headline needs more space. The saved layout is retained.",
    };
  head.fontSize = headFont;
  const panels: AdaptiveLayout["panels"] = [];
  const entrance = Math.min(0.6, duration * 0.12);
  const short = duration < count * 1.35 + 1;
  if (id !== "adaptive-concept" && id !== "adaptive-editorial") {
    const rows = Math.ceil(count / cols),
      cellW = (area.width - gap * (cols - 1)) / cols,
      cellH = (area.height - gap * (rows - 1)) / rows;
    for (let i = 0; i < count; i++) {
      const text =
        scene.items?.[i] ??
        (scene.chart
          ? `${scene.chart.labels[i]} ${scene.chart.series[0].values[i]}${scene.chart.series[0].unit ?? ""}`
          : "");
      let fontSize =
        id === "adaptive-media"
          ? 32 * scale
          : fitAdaptiveText(
              text,
              cellW - pad * 2,
              cellH - pad * 2,
              (variant === "metric" ? 100 : 60) * scale,
              24 * scale,
            );
      if (scene.chart && fontSize) {
        const series = scene.chart.series[0];
        const available = cellW - pad * 2;
        const valueUnits =
          String(series.values[i]).length * 0.8 * 1.2 +
          (series.unit?.length ?? 0) * 0.6 * 0.7;
        const valueMax =
          (available * (variant === "metric" ? 0.9 : 0.48)) /
          Math.max(1, valueUnits);
        fontSize = fitAdaptiveText(
          scene.chart.labels[i],
          available * (variant === "metric" ? 1 : 0.44),
          cellH - pad * 2,
          Math.min(fontSize, valueMax),
          24 * scale,
        );
      }
      if (!fontSize)
        return {
          reason:
            "The supplied labels need more space. The saved layout is retained.",
        };
      panels.push({
        index: i,
        x: area.x + (i % cols) * (cellW + gap),
        y: area.y + Math.floor(i / cols) * (cellH + gap),
        width: cellW,
        height: cellH,
        fontSize,
        at: short
          ? 0
          : 0.15 + i * Math.min(0.32, (duration * 0.3) / (count + 1)),
        focus: short ? 0 : duration * 0.35 + (i * (duration * 0.42)) / count,
      });
    }
  }
  const source = scene.chart
    ? { x, y: y + h * 0.9, width: w, height: h * 0.1, fontSize: 24 * scale }
    : undefined;
  if (
    source &&
    !fitAdaptiveText(
      `${scene.chart!.series[0].label} ${scene.chart!.sourceAttribution ?? ""}`,
      source.width,
      source.height,
      source.fontSize,
      source.fontSize,
    )
  )
    return {
      reason:
        "The complete attribution needs more space. The saved layout is retained.",
    };
  const warnings =
    duration < Math.max(2, scene.text.split(/\s+/).length / 2.5 + count * 0.5)
      ? [
          "Short reading window: all content is revealed early; consider more time.",
        ]
      : [];
  return {
    plan: {
      version: 1,
      recipeId: id,
      recipeVersion: "1.0.0",
      system,
      variant,
      width,
      height,
      duration,
      headline: head,
      panels,
      ...(source ? { source } : {}),
      entrance,
      reason: `${variant} for ${orientation}, ${count} ${count === 1 ? "subject" : "subjects"} and ${dense ? "dense" : "sparse"} copy; ${short ? "early reveal" : "progressive focus"}.`,
      warnings,
    },
  };
}
