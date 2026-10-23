import { escapeHtml as escape } from "@/lib/html";
import type { ReelScene } from "@/video/types";

/** A complete, paged data ledger for charts outside single-series treatments. */
export function buildMultiSeriesScene(args: {
  scene: ReelScene;
  absoluteStart: number;
  duration: number;
  transitionClass: string;
}): string | null {
  const { scene } = args,
    chart = scene.chart;
  if (
    !chart ||
    scene.hideText ||
    (chart.series.length < 2 &&
      chart.labels.length <= 6 &&
      !chart.series.some((series) => series.values.some((value) => value < 0)))
  )
    return null;
  const pages: string[] = [];
  for (let row = 0; row < chart.labels.length; row += 5) {
    for (let column = 0; column < chart.series.length; column += 3) {
      const series = chart.series.slice(column, column + 3);
      pages.push(
        `<div data-series-page="${pages.length}" style="position:absolute;inset:18% 6% 14%;opacity:0"><table style="width:100%;height:100%;table-layout:fixed;border-collapse:collapse;text-align:left"><thead><tr><th style="width:32%;padding:1.5%;border-bottom:2px solid var(--brand-accent-text)">Measure</th>${series.map((s) => `<th style="padding:1.5%;border-bottom:2px solid var(--brand-accent-text)">${escape(s.label)}${s.unit ? `<small style="display:block;font-weight:400">${escape(s.unit)}</small>` : ""}</th>`).join("")}</tr></thead><tbody>${chart.labels
          .slice(row, row + 5)
          .map(
            (label, index) =>
              `<tr><th style="padding:1.5%;border-bottom:1px solid var(--brand-muted);font-weight:500">${escape(label)}</th>${series.map((s) => `<td style="padding:1.5%;border-bottom:1px solid var(--brand-muted);font-variant-numeric:tabular-nums;font-weight:700">${escape(String(s.values[row + index]))}</td>`).join("")}</tr>`,
          )
          .join(
            "",
          )}</tbody></table><p style="font-size:0.65em;text-align:right">Rows ${row + 1}–${Math.min(row + 5, chart.labels.length)} · Series ${column + 1}–${Math.min(column + 3, chart.series.length)}</p></div>`,
      );
    }
  }
  return `<section id="scene-${escape(scene.id)}" class="clip scene motion-scene ${args.transitionClass}" data-scene-id="${escape(scene.id)}" data-start="${args.absoluteStart}" data-duration="${args.duration}" data-track-index="1"><div class="fx-stage" data-motion-scene="${escape(scene.id)}-series" data-recipe="multi-series-chart" style="position:absolute;inset:0;background:var(--brand-background);color:var(--brand-foreground);font-size:clamp(18px,2.5cqw,42px);overflow-wrap:anywhere"><h2 style="position:absolute;inset:5% 6% auto;font-size:1.3em;margin:0">${escape(scene.text)}</h2>${pages.join("")}<p style="position:absolute;inset:auto 6% 4%;font-size:.65em;color:var(--brand-muted)">${escape(chart.sourceAttribution ?? "Supplied values")}${pages.length > 1 ? ` · ${pages.length} data pages` : ""}</p></div></section>`;
}

export const MULTI_SERIES_TIMELINE_BOOT = `
var seriesPages = stage.querySelectorAll('[data-series-page]');
seriesPages.forEach(function(page,index) {
  tl.set(page, {opacity:0}, 0);
  tl.set(page, {opacity:1}, index * sceneDuration / seriesPages.length);
  if(index < seriesPages.length-1) tl.set(page, {opacity:0}, (index+1) * sceneDuration / seriesPages.length);
});`;
