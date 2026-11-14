/**
 * Contact sheets of every registered scene type, built from each type's own
 * sample, in all three formats (roadmap V3).
 *
 *   node scripts/scene-sheet.mjs [--out .artifacts/scenes]
 *
 * Writes a temporary tour storyboard next to the golden examples, runs the
 * frame check on it, then removes it.
 */
import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SCENE_DEFINITIONS } from "../src/engines/hyperframes/scenes/registry.ts";

const args = process.argv.slice(2);
const out = path.resolve(
  args.includes("--out")
    ? args[args.indexOf("--out") + 1]
    : ".artifacts/scenes",
);
const FIELDS = {
  steps: (p) => ({ items: p.items }),
  checklist: (p) => ({ items: p.items }),
  comparison: (p) => ({ compare: { left: p.left, right: p.right } }),
  "before-after": (p) => ({ compare: { left: p.left, right: p.right } }),
  timeline: (p) => ({ points: p.points }),
  diagram: (p) => ({ points: p.points }),
  definition: (p) => ({ definition: p }),
  terminal: (p) => ({ code: { language: "bash", text: p.lines.join("\n") } }),
  "media-split": () => ({ media: { query: "person editing video" } }),
  "device-mockup": (p) => ({ body: p.screen }),
};
const tour = {
  version: 1,
  title: "Scene types",
  format: "9:16",
  scenes: [
    {
      type: "hook",
      headline: "Twenty ways to say it",
      narration: "A tour of every scene type the studio can draw.",
    },
    ...SCENE_DEFINITIONS.map((d) => ({
      type: d.id,
      headline: d.sample.headline,
      narration: d.sample.narration,
      ...(d.sample.emphasis ? { emphasis: d.sample.emphasis } : {}),
      ...(FIELDS[d.id]?.(d.sample.payload) ?? {}),
    })),
    {
      type: "cta",
      headline: "Pick your scenes",
      narration:
        "Pick the scenes that fit your story and let the studio draw them.",
    },
  ],
};
const file = path.resolve("examples/storyboards/zz-scene-tour.json");
writeFileSync(file, JSON.stringify(tour, null, 2));
try {
  execFileSync(
    "node",
    [
      "--import",
      "tsx",
      "scripts/frame-lint.mjs",
      "--only",
      "zz-scene-tour",
      "--all-formats",
      "--out",
      out,
    ],
    { stdio: "inherit" },
  );
} catch {
  /* failures are in the report */
} finally {
  rmSync(file, { force: true });
}
