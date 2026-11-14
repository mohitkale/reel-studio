/**
 * Contact sheet of one storyboard under several seeds (roadmap V11): the same
 * words and theme, a different look for each seed.
 *
 *   node scripts/seed-sheet.mjs [--only listicle] [--seeds 5] [--out .artifacts/seeds]
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const value = (flag, fallback) =>
  args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
const only = value("--only", "listicle");
const count = Number(value("--seeds", "5"));
const out = path.resolve(value("--out", ".artifacts/seeds"));
const COLUMNS = 6;
mkdirSync(out, { recursive: true });
const seeds = Array.from({ length: count }, (_, i) => `seed-${i + 1}`);
const summary = {};
for (const seed of seeds) {
  const dir = path.join(out, seed);
  try {
    execFileSync(
      "node",
      [
        "--import",
        "tsx",
        "scripts/frame-lint.mjs",
        "--only",
        only,
        "--seed",
        seed,
        "--out",
        dir,
      ],
      { stdio: "pipe" },
    );
  } catch {
    /* failures are read from the report */
  }
  const report = JSON.parse(
    readFileSync(path.join(dir, "frame-lint.json"), "utf8"),
  );
  const example = report.examples[0];
  summary[seed] = {
    failures: example.scenes.flatMap((s) => s.failures.map((f) => f.check)),
    monotony: example.monotony,
    looks: example.scenes.map((s) => `${s.layout}/${s.motion}`),
  };
}
const rows = seeds.map((seed) => {
  const row = path.join(out, `${seed}.row.png`);
  const total = summary[seed].looks.length;
  const frames = Array.from({ length: Math.min(COLUMNS, total) }, (_, i) =>
    path.join(out, seed, `${only}-${String(i + 1).padStart(2, "0")}.png`),
  );
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    ...frames.flatMap((f) => ["-i", f]),
    "-filter_complex",
    `${frames.map((_, i) => `[${i}:v]scale=-2:360[v${i}]`).join(";")};${frames.map((_, i) => `[v${i}]`).join("")}hstack=inputs=${frames.length}`,
    "-frames:v",
    "1",
    row,
  ]);
  return row;
});
const sheet = path.join(out, `${only}-seeds.jpg`);
execFileSync("ffmpeg", [
  "-y",
  "-loglevel",
  "error",
  ...rows.flatMap((r) => ["-i", r]),
  "-filter_complex",
  `${rows.map((_, i) => `[${i}:v]`).join("")}vstack=inputs=${rows.length}`,
  "-frames:v",
  "1",
  "-q:v",
  "4",
  sheet,
]);
console.log(`Sheet: ${sheet}`);
for (const [seed, s] of Object.entries(summary))
  console.log(
    `${s.failures.length ? "✗" : "✓"} ${seed}  ${JSON.stringify(s.monotony)}  ${s.looks.join(" ")}  ${[...new Set(s.failures)].join(",")}`,
  );
