/**
 * Cut a release with one command, one PR merge and one tag.
 *
 *   npm run release -- <patch|minor|major> [--dry-run]   bump, changelog, open the release PR
 *   npm run release -- tag [--dry-run]                    after the PR merged: tag main and push
 *
 * The changelog section is built from the squash-merged PR titles since the
 * previous `v*` tag, grouped by `area:*` label. Pushing the tag starts
 * `.github/workflows/release.yml`, which runs the full gate and publishes the
 * GitHub release with the phonemizer corresponding-source archive.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  extractSection,
  insertSection,
  nextVersion,
  parseSubject,
  renderSection,
  type Bump,
  type Change,
} from "./release-lib";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const command = args.find((a) => !a.startsWith("--"));

function run(cmd: string, argv: string[], allowFail = false): string {
  try {
    return execFileSync(cmd, argv, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    if (allowFail) return "";
    throw error;
  }
}
const git = (...argv: string[]) => run("git", argv);

function packageVersion(): string {
  return (
    JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
      version: string;
    }
  ).version;
}

function repoUrl(): string {
  const remote = git("remote", "get-url", "origin")
    .replace(/\.git$/, "")
    .replace(/^git@github\.com:/, "https://github.com/");
  return remote;
}

function requireCleanMain(): void {
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  if (branch !== "main") throw new Error(`Run from main (on ${branch}).`);
  if (git("status", "--porcelain"))
    throw new Error("Working tree is not clean.");
  git("fetch", "origin", "main", "--tags");
  if (git("rev-parse", "HEAD") !== git("rev-parse", "origin/main")) {
    throw new Error("Local main differs from origin/main; pull first.");
  }
}

function lastTag(): string {
  return git("describe", "--tags", "--abbrev=0", "--match", "v*");
}

function collectChanges(since: string): Change[] {
  const lines = git("log", `${since}..HEAD`, "--first-parent", "--format=%s")
    .split("\n")
    .filter(Boolean);
  const changes: Change[] = [];
  for (const subject of lines) {
    const parsed = parseSubject(subject);
    if (!parsed || /^chore: release v\d/.test(parsed.title)) continue;
    let labels: string[] = [];
    try {
      const raw = run("gh", [
        "pr",
        "view",
        String(parsed.number),
        "--json",
        "labels",
        "--jq",
        "[.labels[].name]",
      ]);
      labels = JSON.parse(raw) as string[];
    } catch {
      // Offline or no gh: the entry is listed under "Other changes".
    }
    changes.push({ ...parsed, labels });
  }
  return changes;
}

function countMigrations(since: string): number {
  const names = git(
    "diff",
    "--name-only",
    `${since}..HEAD`,
    "--",
    "prisma/migrations",
  )
    .split("\n")
    .filter((f) => /^prisma\/migrations\/[^/]+\/migration\.sql$/.test(f));
  return names.length;
}

function prepare(bump: Bump) {
  const current = packageVersion();
  const version = nextVersion(current, bump);
  const since = lastTag();
  const changelogPath = path.join(root, "CHANGELOG.md");
  const changelog = readFileSync(changelogPath, "utf8");
  const date = new Date().toISOString().slice(0, 10);
  const { carried } = insertSection(changelog, "");
  const section = renderSection({
    version,
    date,
    changes: collectChanges(since),
    carriedNotes: carried,
    migrations: countMigrations(since),
    repoUrl: repoUrl(),
  });
  return { current, version, since, changelogPath, changelog, section };
}

function release(bump: Bump): void {
  if (!dryRun) requireCleanMain();
  const { current, version, since, changelogPath, changelog, section } =
    prepare(bump);
  console.log(`Release ${current} -> ${version} (changes since ${since})\n`);
  console.log(section);
  if (dryRun) {
    console.log("Dry run: no files, branches or PRs were changed.");
    return;
  }
  if (git("tag", "--list", `v${version}`)) {
    throw new Error(`Tag v${version} already exists.`);
  }
  const branch = `chore/release-v${version}`;
  git("switch", "-c", branch);
  run("npm", ["version", version, "--no-git-tag-version"]);
  writeFileSync(changelogPath, insertSection(changelog, section).text);
  run("npx", ["prettier", "--write", "CHANGELOG.md"]);
  run("npm", ["run", "release:check"]);
  git("add", "package.json", "package-lock.json", "CHANGELOG.md");
  git("commit", "-m", `chore: release v${version}`);
  git("push", "-u", "origin", branch);
  const pr = run("gh", [
    "pr",
    "create",
    "--base",
    "main",
    "--title",
    `chore: release v${version}`,
    "--label",
    "ci:full",
    "--body",
    `Bumps the version to ${version} and adds the changelog section built from merged PR titles.\n\nAfter this merges: \`npm run release -- tag\``,
  ]);
  console.log(
    `\nRelease PR: ${pr}\nAfter it merges, run: npm run release -- tag`,
  );
}

function tag(): void {
  if (!dryRun) requireCleanMain();
  const version = packageVersion();
  if (
    !extractSection(
      readFileSync(path.join(root, "CHANGELOG.md"), "utf8"),
      version,
    )
  ) {
    throw new Error(
      `CHANGELOG.md has no section for ${version}; merge the release PR first.`,
    );
  }
  if (git("tag", "--list", `v${version}`)) {
    throw new Error(`Tag v${version} already exists.`);
  }
  console.log(`Tag v${version} at ${git("rev-parse", "--short", "HEAD")}`);
  if (dryRun) {
    console.log("Dry run: nothing tagged or pushed.");
    return;
  }
  git("tag", "-a", `v${version}`, "-m", `Reel Studio ${version}`);
  git("push", "origin", `v${version}`);
  console.log(
    `Pushed v${version}; .github/workflows/release.yml publishes the release.`,
  );
}

try {
  if (command === "tag") tag();
  else if (command === "patch" || command === "minor" || command === "major") {
    release(command);
  } else {
    console.error(
      "Usage: npm run release -- <patch|minor|major|tag> [--dry-run]",
    );
    process.exit(2);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
