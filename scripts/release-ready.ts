/**
 * `npm run release:ready`: every release check that a machine can run, in one
 * table (roadmap L6). It is the list in docs/RELEASE_READINESS.md, executed.
 *
 *   npm run release:ready [-- --quick]
 *
 * `--quick` skips the slow checks (production build, browser journeys, the
 * frame check of every example). The checks that need a person or a published
 * package (clean-machine `npx` on three systems, the showcase render and review,
 * the tag and the publish) are listed at the end as waiting, never as passed.
 * Writes `.artifacts/release-ready.json` and exits 1 if anything that ran failed.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const quick = process.argv.includes("--quick");

interface Step {
  name: string;
  command: string[];
  slow?: boolean;
}
const STEPS: Step[] = [
  { name: "Types", command: ["npm", "run", "typecheck"] },
  { name: "Lint", command: ["npm", "run", "lint"] },
  {
    name: "Unit tests (includes the Storyboard v1 freeze and golden corpus)",
    command: ["npm", "run", "test:unit"],
  },
  {
    name: "Integration tests",
    command: ["npm", "run", "test:int", "--", "--maxWorkers=2"],
  },
  { name: "Feature parity", command: ["npm", "run", "test:parity"] },
  { name: "Docs links", command: ["npm", "run", "docs:links"] },
  {
    name: "Storyboard schema and prompts are current",
    command: ["npm", "run", "storyboard:schema", "--", "--check"],
  },
  {
    name: "Release metadata, presets and phonemizer provenance",
    command: ["npm", "run", "release:check"],
  },
  { name: "Licence inventory", command: ["npm", "run", "licensing:check"] },
  { name: "Secret scan", command: ["npm", "run", "security:scan"] },
  {
    name: "Dependency audit (production)",
    command: ["npm", "run", "audit:check"],
  },
  {
    name: "Upgrade from v0.3.0 and v0.4.0 data, backup and restore, fresh setup",
    command: ["npm", "run", "test:release-upgrade"],
  },
  {
    name: "Upgrade from v0.8.0 data: projects open and export",
    command: ["npm", "run", "test:upgrade-v080"],
  },
  { name: "Production build", command: ["npm", "run", "build"], slow: true },
  {
    name: "Frame check of every golden storyboard",
    command: ["npm", "run", "examples:lint-frames"],
    slow: true,
  },
  {
    name: "Browser journeys (prompt to download, paste to export, accessibility)",
    command: ["npm", "run", "test:e2e"],
    slow: true,
  },
];
const WAITING = [
  "Clean-machine `npx reel-studio@<version>` on macOS, Linux and Windows (needs the npm package: #110)",
  "Showcase render of the golden set and its review: `npm run showcase` (about 70 minutes; maintainer's call)",
  "Tag `v<version>` on the verified commit, `npm run release`, publish to npm, publish the release with the showcase videos",
];

const results: Array<{
  name: string;
  status: "passed" | "failed" | "skipped";
  seconds: number;
  tail?: string;
}> = [];
for (const step of STEPS) {
  if (quick && step.slow) {
    results.push({ name: step.name, status: "skipped", seconds: 0 });
    continue;
  }
  process.stdout.write(`… ${step.name}\n`);
  const started = Date.now();
  const run = spawnSync(step.command[0]!, step.command.slice(1), {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    shell: process.platform === "win32",
  });
  const seconds = Math.round((Date.now() - started) / 1000);
  const ok = run.status === 0;
  results.push({
    name: step.name,
    status: ok ? "passed" : "failed",
    seconds,
    ...(ok
      ? {}
      : {
          tail: `${run.stdout ?? ""}${run.stderr ?? ""}`
            .split("\n")
            .slice(-25)
            .join("\n"),
        }),
  });
  if (!ok) console.log(results.at(-1)!.tail);
}

mkdirSync(".artifacts", { recursive: true });
writeFileSync(
  ".artifacts/release-ready.json",
  JSON.stringify(
    { at: new Date().toISOString(), quick, results, waiting: WAITING },
    null,
    2,
  ),
);
console.log("\nRelease readiness");
for (const r of results)
  console.log(
    `  ${r.status === "passed" ? "✓" : r.status === "skipped" ? "-" : "✗"} ${r.name}${r.status === "skipped" ? " (skipped by --quick)" : r.status === "passed" ? ` (${r.seconds}s)` : " FAILED"}`,
  );
console.log("\nWaiting (not run here, never counted as passed):");
for (const w of WAITING) console.log(`  · ${w}`);
const failed = results.filter((r) => r.status === "failed").length;
console.log(
  `\n${failed ? `${failed} check(s) failed.` : "Every check that ran passed."}${quick ? " (quick run: the slow checks were skipped.)" : ""}`,
);
process.exit(failed ? 1 : 0);
