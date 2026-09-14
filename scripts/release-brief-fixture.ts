import { createHash } from "node:crypto";

import type { ReelProps } from "../src/compositions/types";
import type { ProductionPresetId } from "../src/production/presets";

function balancedBriefLines(brief: string, count: number): string[] {
  const words = brief.trim().split(/\s+/).filter(Boolean);
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index * words.length) / count);
    const end = Math.floor(((index + 1) * words.length) / count);
    return words.slice(start, Math.max(start + 1, end)).join(" ");
  });
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
  const evidence =
    args.presetId === "data-story" ? dataStoryEvidence(args.briefIndex) : null;
  return {
    ...args.fixture,
    scenes: args.fixture.scenes.map((scene, index) => ({
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
      cues: args.fixture.timeline.map((beat, index) => ({
        id: `release-brief-${args.briefIndex + 1}-${index + 1}`,
        startFrame: beat.startFrame,
        endFrame: beat.startFrame + beat.durationFrames,
        text: lines[index],
      })),
    },
  };
}
