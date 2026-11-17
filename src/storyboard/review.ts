/**
 * Review and revise (roadmap M6): findings about a storyboard phrased as the
 * edit that would fix them, and a small edit language an agent can apply.
 * Pure and deterministic; the agent does the looking, this does the counting.
 */
import { lintStoryboard } from "./lint";

type Scene = Record<string, unknown> & {
  type?: string;
  headline?: string;
  narration?: string;
  durationHint?: number;
};
type Root = Record<string, unknown> & { scenes?: Scene[] };

const WORDS_PER_SECOND = 2.5;
const MAX_HEADLINE_WORDS = 10;
const TARGET_HEADLINE_WORDS = 7;
const MAX_NARRATION_WORDS = 45;

const words = (text: unknown) =>
  typeof text === "string"
    ? text.trim().split(/\s+/).filter(Boolean).length
    : 0;

export interface Finding {
  /** 1-based scene number, or 0 for the whole storyboard. */
  scene: number;
  rule: string;
  /** The suggested storyboard edit, in plain words. */
  suggestion: string;
}

export interface Review {
  findings: Finding[];
  pacing: Array<{
    scene: number;
    type: string;
    seconds: number;
    wordsPerSecond: number;
  }>;
  totalSeconds: number;
}

export function reviewStoryboard(input: unknown): Review {
  const findings: Finding[] = [];
  const lint = lintStoryboard(input);
  for (const e of lint.errors)
    findings.push({
      scene: 0,
      rule: "invalid",
      suggestion: `${e.path || "storyboard"}: ${e.message}. Expected ${e.expected}, for example ${e.example}.`,
    });
  const root = (lint.storyboard ?? input) as Root;
  const scenes = Array.isArray(root.scenes) ? root.scenes : [];
  const pacing: Review["pacing"] = [];
  let total = 0;

  scenes.forEach((scene, i) => {
    const n = i + 1;
    const headline = words(scene.headline);
    if (headline > MAX_HEADLINE_WORDS)
      findings.push({
        scene: n,
        rule: "long-headline",
        suggestion: `scene ${n}: the headline is ${headline} words; shorten it to ${TARGET_HEADLINE_WORDS} or fewer, or move the detail to body.`,
      });
    const spoken = words(scene.narration);
    if (spoken > MAX_NARRATION_WORDS)
      findings.push({
        scene: n,
        rule: "long-narration",
        suggestion: `scene ${n}: the narration is ${spoken} words (about ${Math.round(spoken / WORDS_PER_SECOND)} s); split it into two scenes or cut it to ${MAX_NARRATION_WORDS} words.`,
      });
    const seconds = Math.max(
      2,
      spoken / WORDS_PER_SECOND,
      Number(scene.durationHint) || 0,
    );
    total += seconds;
    pacing.push({
      scene: n,
      type: String(scene.type ?? "?"),
      seconds: Math.round(seconds * 10) / 10,
      wordsPerSecond: Math.round((spoken / seconds) * 10) / 10,
    });
    if (
      i >= 2 &&
      scene.type &&
      scene.type === scenes[i - 1]?.type &&
      scene.type === scenes[i - 2]?.type
    )
      findings.push({
        scene: n,
        rule: "repeated-type",
        suggestion: `scene ${n}: the third "${scene.type}" scene in a row; change its type (for example to a statement, stat, quote or comparison) so neighbouring scenes look different.`,
      });
  });

  if (scenes.length > 0 && scenes[0]!.type !== "hook")
    findings.push({
      scene: 1,
      rule: "no-hook",
      suggestion:
        "scene 1: start with a hook scene that asks a question or states the surprising point.",
    });
  const last = scenes[scenes.length - 1];
  if (last && !["cta", "statement", "quote"].includes(String(last.type)))
    findings.push({
      scene: scenes.length,
      rule: "no-close",
      suggestion: `scene ${scenes.length}: end with a cta or a statement that closes the idea.`,
    });
  const seen = new Map<string, number>();
  scenes.forEach((scene, i) => {
    const key = String(scene.headline ?? "")
      .trim()
      .toLowerCase();
    if (!key) return;
    if (seen.has(key))
      findings.push({
        scene: i + 1,
        rule: "duplicate-headline",
        suggestion: `scene ${i + 1}: the headline repeats scene ${seen.get(key)}; give it its own point.`,
      });
    else seen.set(key, i + 1);
  });
  for (const w of lint.warnings)
    findings.push({
      scene: 0,
      rule: w.rule,
      suggestion: `${w.path}: ${w.message}`,
    });

  return { findings, pacing, totalSeconds: Math.round(total * 10) / 10 };
}

export type Change =
  | { op: "replace"; index: number; scene: Scene }
  | { op: "update"; index: number; fields: Record<string, unknown> }
  | { op: "insert"; index: number; scene: Scene }
  | { op: "remove"; index: number }
  | { op: "move"; from: number; to: number };

export class ChangeError extends Error {}

/** Apply edits to a copy of the storyboard. Indexes are 1-based, in order. */
export function applyChanges(
  input: unknown,
  changes: Change[],
  set: Record<string, unknown> = {},
): Root {
  const root: Root = JSON.parse(JSON.stringify(input));
  const scenes = (root.scenes ??= []);
  const at = (i: number, max = scenes.length) => {
    if (!Number.isInteger(i) || i < 1 || i > max)
      throw new ChangeError(
        `Scene number ${i} is out of range (this storyboard has ${scenes.length} scenes, counted from 1)`,
      );
    return i - 1;
  };
  for (const change of changes) {
    if (change.op === "replace") scenes[at(change.index)] = change.scene;
    else if (change.op === "update")
      Object.assign(scenes[at(change.index)]!, change.fields);
    else if (change.op === "insert")
      scenes.splice(at(change.index, scenes.length + 1), 0, change.scene);
    else if (change.op === "remove") scenes.splice(at(change.index), 1);
    else if (change.op === "move") {
      const [moved] = scenes.splice(at(change.from), 1);
      scenes.splice(at(change.to, scenes.length + 1), 0, moved!);
    }
  }
  Object.assign(root, set);
  return root;
}
