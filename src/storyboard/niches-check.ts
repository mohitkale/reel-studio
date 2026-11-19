/**
 * The niche showcase (roadmap L8): thirty storyboards in `examples/niches`, three
 * for each of ten niches, with the brief each was written from in
 * `examples/niches.json`. Every one must lint with no repairs and no warnings,
 * stay between 20 and 90 seconds, and cite sources when it states facts. The set
 * as a whole must mix formats, themes, voices and presenters, and no two members
 * may share one template (same theme, format and scene order).
 *
 * Shared by `npm run niches:check` and the unit tests.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { estimateDurationSeconds, lintStoryboard } from "./lint";

const examples = path.resolve(import.meta.dirname, "..", "..", "examples");
export const NICHES_DIR = path.join(examples, "niches");
export const NICHES_INDEX = path.join(examples, "niches.json");
export const NICHE_IDS = [
  "tech",
  "coding",
  "finance",
  "fitness",
  "history",
  "productivity",
  "launch",
  "language",
  "science",
  "books",
] as const;
export const NICHE_COUNT = 30;
/** The date the sources were read; lint fills a missing one with this. */
export const NICHES_TODAY = "2026-11-19";

export interface NicheEntry {
  file: string;
  niche: string;
  nicheTitle: string;
  title: string;
  format: string;
  theme: string;
  voice: string;
  style: string;
  presenter: string | null;
  /** True when the video states facts, so it must carry sources. */
  factual: boolean;
  sources: string[];
  brief: string;
}

export function readNicheIndex(): {
  niches: Record<string, string>;
  entries: NicheEntry[];
} {
  return JSON.parse(readFileSync(NICHES_INDEX, "utf8"));
}

export interface NicheReport {
  file: string;
  seconds: number;
  problems: string[];
}

export function checkNiches(): { reports: NicheReport[]; problems: string[] } {
  const index = readNicheIndex();
  const files = readdirSync(NICHES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
  const problems: string[] = [];
  const reports: NicheReport[] = [];

  const indexed = index.entries.map((e) => e.file).sort();
  if (JSON.stringify(indexed) !== JSON.stringify(files))
    problems.push(
      "examples/niches.json and the files in examples/niches do not match",
    );
  if (files.length !== NICHE_COUNT)
    problems.push(`expected ${NICHE_COUNT} storyboards, found ${files.length}`);

  const fingerprints = new Map<string, string>();
  const titles = new Set<string>();
  for (const file of files) {
    const text = readFileSync(path.join(NICHES_DIR, file), "utf8");
    const entry = index.entries.find((e) => e.file === file);
    const found: string[] = [];
    const result = lintStoryboard(text, { today: NICHES_TODAY });
    for (const e of result.errors) found.push(`error ${e.path}: ${e.message}`);
    for (const f of result.fixes)
      found.push(`needed a repair (${f.rule}) at ${f.path || "root"}`);
    for (const w of result.warnings)
      found.push(`warning ${w.rule} at ${w.path || "root"}: ${w.message}`);
    const sb = result.storyboard;
    let seconds = 0;
    if (!sb || sb.kind !== "video") {
      found.push("not a video storyboard");
    } else {
      seconds = estimateDurationSeconds(sb);
      if (seconds < 20 || seconds > 90)
        found.push(
          `estimated ${Math.round(seconds)} s is outside 20 to 90 seconds`,
        );
      if (sb.scenes.length < 4) found.push("fewer than four scenes");
      if (entry?.factual && !(sb.sources && sb.sources.length > 0))
        found.push("states facts but has no sources");
      for (const source of sb.sources ?? [])
        if (!/^https:\/\//.test(source.url))
          found.push(`source ${source.url} is not https`);
      if (entry && sb.format !== entry.format)
        found.push("format differs from niches.json");
      if (entry && sb.theme !== entry.theme)
        found.push("theme differs from niches.json");
      if (entry?.niche === "launch") {
        const closing = sb.scenes
          .map((s) => `${s.narration} ${s.body ?? ""}`)
          .join(" ");
        if (!/fictional|made up|made-up/i.test(closing))
          found.push("a sample product must say it is fictional");
      }
      const fingerprint = `${sb.theme}|${sb.format}|${sb.scenes.map((s) => s.type).join(",")}`;
      const clash = fingerprints.get(fingerprint);
      if (clash)
        found.push(`same template as ${clash} (theme, format and scene order)`);
      fingerprints.set(fingerprint, file);
      if (titles.has(sb.title)) found.push("duplicate title");
      titles.add(sb.title);
    }
    if (/lorem ipsum|reel studio/i.test(text))
      found.push("placeholder or self-referential text");
    if (!entry || entry.brief.length < 40)
      found.push("missing brief in niches.json");
    reports.push({ file, seconds, problems: found });
  }
  problems.push(
    ...reports.flatMap((r) => r.problems.map((p) => `${r.file}: ${p}`)),
  );

  // The set as a whole.
  const entries = index.entries;
  for (const niche of NICHE_IDS) {
    const count = entries.filter((e) => e.niche === niche).length;
    if (count !== 3)
      problems.push(`niche ${niche} has ${count} storyboards, expected 3`);
    if (!index.niches[niche]) problems.push(`niche ${niche} has no title`);
  }
  const formats = new Set(entries.map((e) => e.format));
  for (const format of ["9:16", "16:9", "1:1"])
    if (!formats.has(format)) problems.push(`no storyboard uses ${format}`);
  const themeCounts = new Map<string, number>();
  for (const e of entries)
    themeCounts.set(e.theme, (themeCounts.get(e.theme) ?? 0) + 1);
  if (themeCounts.size < 10)
    problems.push(`only ${themeCounts.size} of the ten themes are used`);
  for (const [theme, n] of themeCounts)
    if (n > 4) problems.push(`theme ${theme} is used ${n} times; at most 4`);
  if (new Set(entries.map((e) => e.voice)).size < 6)
    problems.push("fewer than six different voices");
  if (new Set(entries.map((e) => e.style)).size < 3)
    problems.push("fewer than three voice styles");
  const presenters = new Set(entries.map((e) => e.presenter).filter(Boolean));
  if (presenters.size < 3)
    problems.push("fewer than three different presenters");
  return { reports, problems };
}
