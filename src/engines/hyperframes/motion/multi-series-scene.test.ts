import { expect, it } from "vitest";
import { gsap } from "gsap";
import {
  buildMultiSeriesScene,
  MULTI_SERIES_TIMELINE_BOOT,
} from "./multi-series-scene";
it("retains all supplied series and negative values across seek-safe pages", () => {
  const labels = Array.from({ length: 6 }, (_, i) => `Row ${i + 1}`);
  const series = Array.from({ length: 4 }, (_, i) => ({
    label: `Series ${i + 1}`,
    unit: "count",
    values: labels.map((_, j) => (i + 1) * 100 + j - 500),
  }));
  const html = buildMultiSeriesScene({
    scene: {
      id: "chart",
      templateId: "hf-statement",
      text: "<script> stays text",
      emphasis: [],
      chart: { labels, series, sourceAttribution: "Fixture" },
    },
    absoluteStart: 0,
    duration: 12,
    transitionClass: "",
  })!;
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  expect(container.querySelector("script")).toBeNull();
  const pages = Array.from(
    container.querySelectorAll<HTMLElement>("[data-series-page]"),
  );
  expect(pages).toHaveLength(4);
  const values = Array.from(
    container.querySelectorAll("td"),
    (td) => td.textContent,
  );
  expect(values.sort()).toEqual(
    series.flatMap((s) => s.values.map(String)).sort(),
  );
  const tl = gsap.timeline({ paused: true });
  new Function("stage", "tl", "sceneDuration", MULTI_SERIES_TIMELINE_BOOT)(
    container,
    tl,
    12,
  );
  try {
    for (const time of [1, 4, 7, 10, 1]) {
      tl.seek(time, true);
      expect(pages.map((p) => p.style.opacity)).toEqual(
        pages.map((_, i) => (i === Math.floor(time / 3) ? "1" : "0")),
      );
    }
  } finally {
    tl.kill();
    container.remove();
  }
});

it("shows negative single-series values and respects hidden text", () => {
  const args = {
    scene: {
      id: "negative",
      templateId: "hf-statement",
      text: "Change",
      emphasis: [],
      chart: {
        labels: ["Before", "After"],
        series: [{ label: "Change", values: [-4, 9] }],
      },
    },
    absoluteStart: 0,
    duration: 6,
    transitionClass: "",
  };
  expect(buildMultiSeriesScene(args)).toContain(">-4</td>");
  expect(
    buildMultiSeriesScene({
      ...args,
      scene: { ...args.scene, hideText: true },
    }),
  ).toBeNull();
});
