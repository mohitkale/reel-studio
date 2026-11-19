/**
 * `npm run niches:variety`: do the thirty niche videos look different from each
 * other? (roadmap L8, building on the per-video monotony check of V11)
 *
 * Reads the frames `scripts/frame-lint.mjs --set niches` wrote (one per scene) and
 * gives each video a fingerprint: a 64-bit difference hash of each of its first
 * four scenes, which captures layout and light and dark, not colour alone. Two
 * videos are the same template when their fingerprints differ in less than
 * MIN_DISTANCE of the bits. The check also asks for a spread of themes, formats and
 * scene types across the set.
 *
 *   node --import tsx scripts/frame-lint.mjs --set niches
 *   npm run niches:variety [-- --min 0.15]
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { readNicheIndex } from "../src/storyboard/niches-check";

const args = process.argv.slice(2);
const minArg = args.indexOf("--min");
const MIN_DISTANCE = minArg >= 0 ? Number(args[minArg + 1]) : 0.15;
const FRAMES = path.resolve(".artifacts/frame-lint-niches");
const SCENES_PER_VIDEO = 4;

/** 64-bit difference hash: nine columns by eight rows of grey, left pixel brighter than right. */
function dHash(file: string): boolean[] {
  const raw = execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-i",
      file,
      "-vf",
      "scale=9:8:flags=area,format=gray",
      "-f",
      "rawvideo",
      "-",
    ],
    { maxBuffer: 1024 },
  );
  const bits: boolean[] = [];
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++)
      bits.push(raw[y * 9 + x]! > raw[y * 9 + x + 1]!);
  return bits;
}

const entries = readNicheIndex().entries;
const prints = new Map<string, boolean[]>();
for (const entry of entries) {
  const name = entry.file.replace(/\.json$/, "");
  const bits: boolean[] = [];
  for (let i = 1; i <= SCENES_PER_VIDEO; i++) {
    const frame = path.join(
      FRAMES,
      `${name}-${String(i).padStart(2, "0")}.png`,
    );
    if (!existsSync(frame))
      throw new Error(
        `Missing ${path.relative(".", frame)}. Run: node --import tsx scripts/frame-lint.mjs --set niches`,
      );
    bits.push(...dHash(frame));
  }
  prints.set(name, bits);
}

const names = [...prints.keys()];
const pairs: Array<{ a: string; b: string; distance: number }> = [];
for (let i = 0; i < names.length; i++)
  for (let j = i + 1; j < names.length; j++) {
    const a = prints.get(names[i]!)!;
    const b = prints.get(names[j]!)!;
    pairs.push({
      a: names[i]!,
      b: names[j]!,
      distance: a.filter((bit, k) => bit !== b[k]).length / a.length,
    });
  }
pairs.sort((x, y) => x.distance - y.distance);
const mean = pairs.reduce((sum, p) => sum + p.distance, 0) / pairs.length;

console.log(
  `Closest pairs of ${names.length} videos (fraction of fingerprint bits that differ; minimum ${MIN_DISTANCE}):`,
);
for (const p of pairs.slice(0, 6))
  console.log(`  ${p.distance.toFixed(3)}  ${p.a}  /  ${p.b}`);
console.log(`Mean distance ${mean.toFixed(3)}`);

// Scene types across the set: how many of the twenty-one are used.
const types = new Set<string>();
for (const entry of entries) {
  const sb = JSON.parse(
    readFileSync(path.resolve("examples/niches", entry.file), "utf8"),
  ) as { scenes: Array<{ type: string }> };
  for (const s of sb.scenes) types.add(s.type);
}
console.log(
  `Scene types used: ${types.size} of 21; themes: ${new Set(entries.map((e) => e.theme)).size} of 10; formats: ${new Set(entries.map((e) => e.format)).size} of 3`,
);

const failures = pairs.filter((p) => p.distance < MIN_DISTANCE);
if (failures.length) {
  console.error(`\n${failures.length} pair(s) look like the same template:`);
  for (const p of failures)
    console.error(`  ${p.distance.toFixed(3)}  ${p.a}  /  ${p.b}`);
  process.exit(1);
}
console.log("\nNo two videos share a template.");
