import { describe, expect, it } from "vitest";

import {
  extractSection,
  groupChanges,
  insertSection,
  nextVersion,
  parseSubject,
  renderSection,
} from "../../scripts/release-lib";

describe("nextVersion", () => {
  it("bumps patch, minor and major", () => {
    expect(nextVersion("0.8.3", "patch")).toBe("0.8.4");
    expect(nextVersion("0.8.3", "minor")).toBe("0.9.0");
    expect(nextVersion("0.8.3", "major")).toBe("1.0.0");
  });

  it("rejects non-semver input", () => {
    expect(() => nextVersion("0.9", "patch")).toThrow();
    expect(() => nextVersion("1.0.0-rc.1", "patch")).toThrow();
  });
});

describe("parseSubject", () => {
  it("splits a squash-merge subject", () => {
    expect(parseSubject("docs: single agent rule file (#157)")).toEqual({
      title: "docs: single agent rule file",
      number: 157,
    });
  });

  it("ignores commits without a PR number", () => {
    expect(parseSubject("Merge branch 'x'")).toBeNull();
  });
});

describe("renderSection", () => {
  const changes = [
    { number: 1, title: "feat: scenes", labels: ["area:engine"] },
    { number: 2, title: "fix: tool name", labels: ["area:mcp", "breaking"] },
    { number: 3, title: "chore: stuff", labels: [] },
  ];

  it("groups by area label and lists breaking changes first", () => {
    const text = renderSection({
      version: "0.9.0",
      date: "2026-11-13",
      changes,
      migrations: 0,
      repoUrl: "https://github.com/o/r",
    });
    expect(text).toContain("## 0.9.0 (2026-11-13)");
    expect(text.indexOf("### Breaking changes")).toBeLessThan(
      text.indexOf("### Engine and rendering"),
    );
    expect(text).toContain(
      "- feat: scenes ([#1](https://github.com/o/r/pull/1))",
    );
    expect(text).toContain("### Other changes");
    expect(text).not.toContain("### Upgrade notes");
  });

  it("adds upgrade notes only when a migration shipped", () => {
    const text = renderSection({
      version: "0.9.0",
      date: "2026-11-13",
      changes: [],
      migrations: 2,
      repoUrl: "https://github.com/o/r",
    });
    expect(text).toContain("adds 2 database migrations");
  });

  it("drops empty groups", () => {
    expect([...groupChanges([changes[0]!]).keys()]).toEqual([
      "Engine and rendering",
    ]);
  });
});

describe("changelog editing", () => {
  const changelog =
    "# Changelog\n\n## Unreleased\n\nNote.\n\n## 0.8.0\n\nOld.\n";

  it("inserts below Unreleased and returns carried notes", () => {
    const { text, carried } = insertSection(
      changelog,
      "## 0.9.0 (d)\n\nNew.\n",
    );
    expect(carried).toBe("Note.");
    expect(text.indexOf("## Unreleased")).toBeLessThan(
      text.indexOf("## 0.9.0"),
    );
    expect(text.indexOf("## 0.9.0")).toBeLessThan(text.indexOf("## 0.8.0"));
  });

  it("extracts one version's section", () => {
    expect(extractSection(changelog, "0.8.0")).toBe("Old.\n");
    expect(extractSection(changelog, "0.7.0")).toBeNull();
  });
});
