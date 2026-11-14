/**
 * Contact sheet of one storyboard in every theme (roadmap V5).
 *
 *   node scripts/theme-sheet.mjs [--only product-launch] [--out .artifacts/themes]
 *
 * Runs the frame check once per theme, then lays the first four scenes of each
 * theme side by side (one row per theme) with ffmpeg.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const value = (flag, fallback) =>
  args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
const only = value("--only", "product-launch");
const out = path.resolve(value("--out", ".artifacts/themes"));
const themes = [
  "bold-pop",
  "clean-minimal",
  "midnight-tech",
  "editorial-paper",
  "neon",
  "warm-documentary",
  "corporate-blue",
  "playful-pastel",
  "mono-brutalist",
  "cinematic",
];
const COLUMNS = 4;
mkdirSync(out, { recursive: true });
const failures = {};
for (const theme of themes) {
  const dir = path.join(out, theme);
  try {
    execFileSync(
      "node",
      [
        "--import",
        "tsx",
        "scripts/frame-lint.mjs",
        "--only",
        only,
        "--theme",
        theme,
        "--out",
        dir,
      ],
      { stdio: "pipe" },
    );
  } catch {
    /* the report is still written; failures are read from it */
  }
  const report = JSON.parse(
    readFileSync(path.join(dir, "frame-lint.json"), "utf8"),
  );
  failures[theme] = report.examples.flatMap((e) =>
    e.scenes.flatMap((s) => s.failures.map((f) => f.check)),
  );
}
const rows = themes.map((theme) => {
  const row = path.join(out, `${theme}.row.png`);
  const frames = Array.from({ length: COLUMNS }, (_, i) =>
    path.join(out, theme, `${only}-${String(i + 1).padStart(2, "0")}.png`),
  );
  const inputs = frames.flatMap((f) => ["-i", f]);
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    ...inputs,
    "-filter_complex",
    `${frames.map((_, i) => `[${i}:v]scale=-2:420[v${i}]`).join(";")};${frames.map((_, i) => `[v${i}]`).join("")}hstack=inputs=${COLUMNS}`,
    "-frames:v",
    "1",
    row,
  ]);
  return row;
});
const sheet = path.join(out, `${only}-themes.jpg`);
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
for (const [theme, list] of Object.entries(failures))
  console.log(
    `${list.length ? "✗" : "✓"} ${theme.padEnd(17)} ${list.length ? [...new Set(list)].join(", ") : ""}`,
  );
