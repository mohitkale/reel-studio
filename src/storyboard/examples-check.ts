/**
 * The golden storyboards in examples/storyboards: validated and linted with zero
 * fixes, warnings and errors. Shared by `npm run examples:check` and the unit tests.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { estimateDurationSeconds, lintStoryboard } from "./lint";

export const EXAMPLES_DIR = path.resolve(
  import.meta.dirname,
  "..",
  "..",
  "examples",
  "storyboards",
);
export const GOLDEN_COUNT = 12;
/** Roadmap V3: the golden set shows the scene library, not nine types. */
export const MIN_SCENE_TYPES = 14;

export interface ExampleReport {
  name: string;
  kind: "video" | "podcast" | "invalid";
  format?: string;
  seconds: number;
  problems: string[];
}

export function checkExamples(dir = EXAMPLES_DIR): {
  reports: ExampleReport[];
  problems: string[];
} {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  const reports: ExampleReport[] = [];
  const sceneTypes = new Set<string>();
  for (const file of files) {
    const text = readFileSync(path.join(dir, file), "utf8");
    const result = lintStoryboard(text, { today: "2026-11-13" });
    const problems: string[] = [];
    for (const e of result.errors)
      problems.push(`error ${e.path}: ${e.message}`);
    for (const f of result.fixes)
      problems.push(`needed a repair (${f.rule}) at ${f.path || "root"}`);
    for (const w of result.warnings)
      problems.push(`warning ${w.rule} at ${w.path || "root"}: ${w.message}`);
    const sb = result.storyboard;
    if (sb?.kind === "video") for (const scene of sb.scenes) sceneTypes.add(scene.type);
    const seconds = sb ? estimateDurationSeconds(sb) : 0;
    if (sb?.kind === "video" && (seconds < 20 || seconds > 90)) {
      problems.push(
        `estimated ${Math.round(seconds)} s is outside 20 to 90 seconds`,
      );
    }
    if (/lorem ipsum|reel studio/i.test(text)) {
      problems.push("placeholder or self-referential text");
    }
    reports.push({
      name: file.replace(/\.json$/, ""),
      kind: sb ? sb.kind : "invalid",
      format: sb?.kind === "video" ? sb.format : undefined,
      seconds,
      problems,
    });
  }
  const problems = reports.flatMap((r) =>
    r.problems.map((p) => `${r.name}: ${p}`),
  );
  if (reports.length !== GOLDEN_COUNT) {
    problems.push(
      `expected ${GOLDEN_COUNT} golden storyboards, found ${reports.length}`,
    );
  }
  const formats = new Set(reports.map((r) => r.format).filter(Boolean));
  for (const format of ["9:16", "16:9", "1:1"]) {
    if (!formats.has(format)) problems.push(`no example uses ${format}`);
  }
  if (sceneTypes.size < MIN_SCENE_TYPES) {
    problems.push(
      `the golden set uses ${sceneTypes.size} scene types; at least ${MIN_SCENE_TYPES} are required`,
    );
  }
  if (!reports.some((r) => r.kind === "podcast"))
    problems.push("no podcast example");
  return { reports, problems };
}
