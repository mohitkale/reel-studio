/**
 * The golden storyboards as starting points (roadmap U6): listed with the facts
 * a person chooses by (look, scene types, length) and read back for remixing.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { estimateDurationSeconds, lintStoryboard } from "@/storyboard";

const dir = () => path.join(process.cwd(), "examples", "storyboards");

export interface ExampleSummary {
  name: string;
  title: string;
  format: string;
  theme: string;
  seconds: number;
  sceneTypes: string[];
}

const NAME = /^[a-z0-9][a-z0-9-]{0,60}$/;

function readStoryboard(name: string): Record<string, unknown> | null {
  if (!NAME.test(name)) return null;
  try {
    const value = JSON.parse(
      readFileSync(path.join(dir(), `${name}.json`), "utf8"),
    ) as Record<string, unknown>;
    return value.kind === "podcast" ? null : value;
  } catch {
    return null;
  }
}

export function listExamples(): ExampleSummary[] {
  let files: string[] = [];
  try {
    files = readdirSync(dir())
      .filter((f) => f.endsWith(".json"))
      .sort();
  } catch {
    return [];
  }
  const out: ExampleSummary[] = [];
  for (const file of files) {
    const name = file.replace(/\.json$/, "");
    const sb = readStoryboard(name);
    if (!sb) continue;
    const lint = lintStoryboard(sb);
    if (!lint.storyboard || lint.storyboard.kind !== "video") continue;
    out.push({
      name,
      title: lint.storyboard.title,
      format: lint.storyboard.format,
      theme: String(sb.theme ?? "auto"),
      seconds: Math.round(estimateDurationSeconds(lint.storyboard)),
      sceneTypes: [...new Set(lint.storyboard.scenes.map((s) => s.type))],
    });
  }
  return out;
}

export function readExample(name: string): Record<string, unknown> | null {
  return readStoryboard(name);
}
