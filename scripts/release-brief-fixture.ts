import { createHash } from "node:crypto";

import type { ReelProps } from "../src/video/types";
import type { ProductionPresetId } from "../src/production/presets";

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Split a part at the clause boundary nearest its middle; null when it has none. */
function splitAtClause(part: string): [string, string] | null {
  const marks = [...part.matchAll(/[,;:](?=\s)|\s(?=(?:then|and|but|so)\s)/g)]
    .map((m) => (m[0].trim() ? m.index! + 1 : m.index!))
    .filter(
      (at) =>
        wordCount(part.slice(0, at)) >= 2 &&
        wordCount(part.slice(at)) >= 2 &&
        // A comma or "and" inside a list of numbers is not a clause boundary.
        !/\d$/.test(
          part
            .slice(0, at)
            .trimEnd()
            .replace(/[,;:]$/, ""),
        ) &&
        !/^[,;:]?\s*(?:and\s+)?\d/.test(part.slice(at)),
    );
  if (marks.length === 0) return null;
  const middle = part.length / 2;
  const at = marks.reduce((best, mark) =>
    Math.abs(mark - middle) < Math.abs(best - middle) ? mark : best,
  );
  return [part.slice(0, at).trim(), part.slice(at).trim()];
}

/**
 * Spread the brief over the scenes at sentence and clause boundaries, so no
 * on-screen line ends mid-clause. Joined with spaces the lines are the brief.
 */
function balancedBriefLines(brief: string, count: number): string[] {
  let parts = brief
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  while (parts.length < count) {
    // Split the longest part that still has a clause boundary.
    const order = parts
      .map((p, i) => [i, wordCount(p)] as const)
      .sort((a, b) => b[1] - a[1]);
    const target = order.find(([i]) => splitAtClause(parts[i]!));
    if (!target) break;
    const halves = splitAtClause(parts[target[0]]!)!;
    parts = [
      ...parts.slice(0, target[0]),
      ...halves,
      ...parts.slice(target[0] + 1),
    ];
  }
  while (parts.length > count) {
    // Merge the two shortest neighbours.
    let at = 0;
    for (let i = 1; i < parts.length - 1; i++) {
      if (
        wordCount(parts[i]!) + wordCount(parts[i + 1]!) <
        wordCount(parts[at]!) + wordCount(parts[at + 1]!)
      )
        at = i;
    }
    parts = [
      ...parts.slice(0, at),
      `${parts[at]} ${parts[at + 1]}`,
      ...parts.slice(at + 2),
    ];
  }
  // With no clause boundary left, return fewer lines than scenes; the caller
  // keeps a spread of scenes instead of cutting a clause.
  return parts;
}

function dataStoryEvidence(briefIndex: number) {
  if (briefIndex === 0) {
    return {
      visual: "120 → 180",
      chart: {
        labels: ["Previous", "Current"],
        series: [{ label: "Completed exports", values: [120, 180], unit: "" }],
        sourceAttribution: "Supplied project log",
      },
    };
  }
  if (briefIndex === 1) {
    return {
      visual: "18 → 11 min",
      chart: {
        labels: ["Previous", "September"],
        series: [
          { label: "Median review time", values: [18, 11], unit: " min" },
        ],
        sourceAttribution: "Supplied review audit",
      },
    };
  }
  return {
    visual: "24 · 21 · 19",
    chart: {
      labels: ["Portrait", "Landscape", "Square"],
      series: [{ label: "Completed variants", values: [24, 21, 19], unit: "" }],
      sourceAttribution: "Supplied test batch",
    },
  };
}

export function releaseBriefHash(brief: string): string {
  return createHash("sha256").update(brief).digest("hex");
}

/** Apply the actual acceptance brief to every visible scene in the fixture. */
export function applyReleaseBriefToFixture(args: {
  fixture: ReelProps;
  presetId: ProductionPresetId;
  brief: string;
  briefIndex: number;
}): ReelProps {
  const lines = balancedBriefLines(args.brief, args.fixture.scenes.length);
  const total = args.fixture.scenes.length;
  // Keep a spread of scenes (always the first and the last) when the brief has
  // fewer complete parts than the fixture has scenes.
  const keep =
    lines.length >= total
      ? args.fixture.scenes.map((_, index) => index)
      : lines.map((_, index) =>
          lines.length === 1
            ? 0
            : Math.round((index * (total - 1)) / (lines.length - 1)),
        );
  const keptScenes = keep.map((index) => args.fixture.scenes[index]!);
  let frame = 0;
  const timeline = keptScenes.map((scene) => {
    const beat = args.fixture.timeline.find((b) => b.sceneId === scene.id)!;
    const next = { ...beat, startFrame: frame };
    frame += beat.durationFrames;
    return next;
  });
  const evidence =
    args.presetId === "data-story" ? dataStoryEvidence(args.briefIndex) : null;
  return {
    ...args.fixture,
    timeline,
    scenes: keptScenes.map((scene, index) => ({
      ...scene,
      text: lines[index],
      spokenText: undefined,
      emphasis: [],
      ...(evidence && scene.role === "metric"
        ? { visual: evidence.visual }
        : {}),
      ...(evidence && scene.chart ? { chart: evidence.chart } : {}),
    })),
    captions: {
      enabled: true,
      timingSource: "imported",
      cues: timeline.map((beat, index) => ({
        id: `release-brief-${args.briefIndex + 1}-${index + 1}`,
        startFrame: beat.startFrame,
        endFrame: beat.startFrame + beat.durationFrames,
        text: lines[index],
      })),
    },
  };
}
