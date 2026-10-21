/** Opt-in active-app baseline. Uses installed dependencies, never npm install. */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  symlinkSync,
  copyFileSync,
  realpathSync,
} from "node:fs";
import path from "node:path";
import { databaseUrl, loadLocalEnvironment } from "./database-url.mjs";
import { inspectAndBackup } from "./migrate-database.mjs";
import corpus from "../tests/fixtures/adaptive-baseline.json";

const root = process.cwd(),
  output = path.resolve(
    process.argv
      .find((arg) => arg.startsWith("--output-root="))
      ?.slice("--output-root=".length) || ".artifacts/adaptive-m0",
  ),
  historical = path.join(output, "baseline-source");
const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8" }).trim();
const sha = (file: string) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");
function dependencyLock(file: string) {
  const lock = JSON.parse(readFileSync(file, "utf8"));
  // A release version bump does not change the installed dependency graph.
  delete lock.version;
  delete lock.packages[""].version;
  return JSON.stringify(lock);
}
mkdirSync(output, { recursive: true });
loadLocalEnvironment();
assert.equal(corpus.cases.length, 12);
assert.equal(new Set(corpus.cases.map((c) => c.presetId)).size, 6);
assert.equal(new Set(corpus.cases.map((c) => c.orientation)).size, 3);
for (const language of ["en", "hi", "hinglish"])
  assert(corpus.cases.some((c) => c.language === language));
const backup = inspectAndBackup(databaseUrl().slice(5));
writeFileSync(
  path.join(output, "backup.json"),
  JSON.stringify({
    created: Boolean(backup.backup),
    at: new Date().toISOString(),
  }),
);
if (!existsSync(path.join(historical, "package.json"))) {
  mkdirSync(historical, { recursive: true });
  const archive = path.join(output, "v050-source.tar");
  execFileSync("git", [
    "archive",
    "--format=tar",
    `--output=${archive}`,
    "v0.5.0",
  ]);
  execFileSync("tar", ["-xf", archive, "-C", historical]);
}
for (const name of ["node_modules", "media"]) {
  const destination = path.join(historical, name);
  if (!existsSync(destination))
    symlinkSync(path.join(root, name), destination, "dir");
  assert.equal(realpathSync(destination), realpathSync(name));
}
// Verify source bytes before executing the historical renderer. The only added
// code is this opt-in runner; dependencies and the producer are unchanged pins.
for (const file of [
  "src/library/hyperframes-render.ts",
  "src/library/repositories/projects.ts",
  "src/production/motion-plan.ts",
  "src/engines/hyperframes/build-composition.ts",
])
  assert.equal(
    readFileSync(path.join(historical, file), "utf8"),
    execFileSync("git", ["show", `v0.5.0:${file}`], { encoding: "utf8" }),
  );
copyFileSync(
  "scripts/verify-adaptive-baseline-film.ts",
  path.join(historical, "scripts/verify-adaptive-baseline-film.ts"),
);
const source = {
  historicalCommit: git("rev-parse", "v0.5.0^{commit}"),
  historicalTagObject: git("rev-parse", "v0.5.0"),
  candidateBaseCommit: git("rev-parse", "HEAD"),
  candidateBaseSrcTree: git("rev-parse", "HEAD:src"),
  candidateSourceContentSha256: createHash("sha256")
    .update(
      JSON.stringify(
        git(
          "ls-files",
          "src",
          "public/reel-runtime",
          "scripts/hyperframes-render-worker.mjs",
        )
          .split("\n")
          .map((file) => ({ file, sha256: sha(file) })),
      ),
    )
    .digest("hex"),
  corpusSha256: sha("tests/fixtures/adaptive-baseline.json"),
  mediaSha256: sha("tests/fixtures/adaptive-baseline-media.png"),
  runnerSha256: sha("scripts/verify-adaptive-baseline-film.ts"),
  dependenciesUnchanged:
    dependencyLock("package-lock.json") ===
    dependencyLock(path.join(historical, "package-lock.json")),
};
assert(source.dependenciesUnchanged);
if (existsSync(path.join(output, "source.json"))) {
  const previous = JSON.parse(
    readFileSync(path.join(output, "source.json"), "utf8"),
  );
  for (const key of [
    "historicalCommit",
    "candidateSourceContentSha256",
    "corpusSha256",
    "mediaSha256",
  ] as const)
    assert.equal(
      previous[key],
      source[key],
      `${key} changed; use a fresh --output-root for new evidence`,
    );
}
writeFileSync(
  path.join(output, "source.json"),
  JSON.stringify(source, null, 2),
);
for (const version of ["v0.5.0", "current"]) {
  const cwd = version === "current" ? root : historical;
  const result = spawnSync(
    process.execPath,
    [
      path.join(root, "node_modules/tsx/dist/cli.mjs"),
      "--tsconfig",
      path.join(cwd, "tsconfig.json"),
      "scripts/verify-adaptive-baseline-film.ts",
      path.join(root, "tests/fixtures/adaptive-baseline.json"),
      path.join(output, "outputs"),
      version,
    ],
    {
      cwd,
      env: { ...process.env, DATABASE_URL: databaseUrl(), REEL_M0_ROOT: root },
      stdio: "inherit",
    },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(
  "M0 paired exports completed. Review all sampled frames and record limits/rubric before acceptance.",
);
