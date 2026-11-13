/** Pure helpers for scripts/release.ts: versions, grouping and changelog text. */

export type Bump = "patch" | "minor" | "major";

export function nextVersion(current: string, bump: Bump): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (!match) throw new Error(`Not a plain semver version: ${current}`);
  const [major, minor, patch] = match.slice(1).map(Number) as [
    number,
    number,
    number,
  ];
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

export interface Change {
  number: number;
  title: string;
  labels: string[];
}

/** `feat: thing (#12)` → `{ title: "feat: thing", number: 12 }`. */
export function parseSubject(
  subject: string,
): { title: string; number: number } | null {
  const match = /^(.*?)\s*\(#(\d+)\)$/.exec(subject.trim());
  if (!match) return null;
  return { title: match[1]!.trim(), number: Number(match[2]) };
}

const AREAS: [string, string][] = [
  ["area:engine", "Engine and rendering"],
  ["area:storyboard", "Storyboard"],
  ["area:mcp", "MCP"],
  ["area:studio", "Studio"],
  ["area:audio", "Audio and podcasts"],
  ["area:ci", "CI and tooling"],
  ["area:docs", "Documentation"],
  ["area:repo", "Repository"],
];
const OTHER = "Other changes";

export function groupChanges(changes: Change[]): Map<string, Change[]> {
  const groups = new Map<string, Change[]>();
  for (const [, heading] of AREAS) groups.set(heading, []);
  groups.set(OTHER, []);
  for (const change of changes) {
    const area = AREAS.find(([label]) => change.labels.includes(label));
    groups.get(area ? area[1] : OTHER)!.push(change);
  }
  for (const [heading, list] of groups) {
    if (list.length === 0) groups.delete(heading);
  }
  return groups;
}

export interface SectionInput {
  version: string;
  date: string;
  changes: Change[];
  carriedNotes?: string;
  migrations: number;
  repoUrl: string;
}

export function renderSection(input: SectionInput): string {
  const lines = [`## ${input.version} (${input.date})`, ""];
  const notes = input.carriedNotes?.trim();
  if (notes) lines.push(notes, "");
  const breaking = input.changes.filter((c) => c.labels.includes("breaking"));
  if (breaking.length > 0) {
    lines.push("### Breaking changes", "");
    for (const c of breaking) lines.push(entry(c, input.repoUrl));
    lines.push("");
  }
  if (input.migrations > 0) {
    lines.push(
      "### Upgrade notes",
      "",
      `This release adds ${input.migrations} database migration${input.migrations === 1 ? "" : "s"}. ` +
        "Stop the app, back up the database and `media/` folder together, then run `npm run setup`. " +
        "See [upgrading](docs/GETTING_STARTED.md#upgrading-and-rolling-back).",
      "",
    );
  }
  for (const [heading, list] of groupChanges(input.changes)) {
    lines.push(`### ${heading}`, "");
    for (const c of list) lines.push(entry(c, input.repoUrl));
    lines.push("");
  }
  if (input.changes.length === 0 && !notes) {
    lines.push("No merged pull requests since the previous release.", "");
  }
  return lines.join("\n").replace(/\n+$/, "\n");
}

function entry(change: Change, repoUrl: string): string {
  return `- ${change.title} ([#${change.number}](${repoUrl}/pull/${change.number}))`;
}

/** Insert a section below `## Unreleased`, moving that heading's notes into it. */
export function insertSection(
  changelog: string,
  section: string,
): { text: string; carried: string } {
  const marker = "## Unreleased";
  const start = changelog.indexOf(marker);
  if (start === -1)
    throw new Error("CHANGELOG.md has no '## Unreleased' heading");
  const afterHeading = start + marker.length;
  const rest = changelog.slice(afterHeading);
  const next = rest.search(/^## /m);
  const carried = (next === -1 ? rest : rest.slice(0, next)).trim();
  const tail = next === -1 ? "" : rest.slice(next);
  return {
    text: `${changelog.slice(0, afterHeading)}\n\n${section}\n${tail}`,
    carried,
  };
}

/** The body of the `## <version>` section, without its heading. */
export function extractSection(
  changelog: string,
  version: string,
): string | null {
  const escaped = version.replaceAll(".", "\\.");
  const match = new RegExp(`^## ${escaped}\\b.*$`, "m").exec(changelog);
  if (!match) return null;
  const from = match.index + match[0].length;
  const rest = changelog.slice(from);
  const next = rest.search(/^## /m);
  return (next === -1 ? rest : rest.slice(0, next)).trim() + "\n";
}
