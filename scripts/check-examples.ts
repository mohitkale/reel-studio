/** `npm run examples:check`: validate and lint the twelve golden storyboards. Fast. */
import { checkExamples } from "../src/storyboard/examples-check";

const { reports, problems } = checkExamples();
for (const r of reports) {
  console.log(
    `${r.problems.length ? "✗" : "✓"} ${r.name.padEnd(16)} ${r.kind.padEnd(8)} ${(r.format ?? "audio").padEnd(5)} ~${Math.round(r.seconds)} s`,
  );
}
if (problems.length > 0) {
  console.error(`\nExamples FAILED (${problems.length} problems):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(
  `\n${reports.length} golden storyboards validate with zero fixes, warnings and errors.`,
);
