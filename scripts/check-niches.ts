/** `npm run niches:check`: validate and lint the thirty niche showcase storyboards. Fast. */
import { checkNiches } from "../src/storyboard/niches-check";

const { reports, problems } = checkNiches();
for (const r of reports)
  console.log(
    `${r.problems.length ? "✗" : "✓"} ${r.file.padEnd(60)} ~${Math.round(r.seconds)} s`,
  );
if (problems.length > 0) {
  console.error(`\nNiche showcase FAILED (${problems.length} problems):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(
  `\n${reports.length} niche storyboards lint with zero fixes, warnings and errors.`,
);
