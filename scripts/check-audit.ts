/**
 * `npm run audit:check`: the dependency audit as a gate (roadmap L6).
 *
 * Runs `npm audit --omit=dev` and fails on any critical or high advisory in a
 * production dependency that is not listed, with a reason and a review date, in
 * `docs/security-exceptions.json`. A listed exception whose review date has
 * passed fails too, so an old decision is looked at again. Needs the network.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

interface Exception {
  package: string;
  severity: string;
  reason: string;
  reviewBy: string;
}
const { exceptions } = JSON.parse(
  readFileSync("docs/security-exceptions.json", "utf8"),
) as { exceptions: Exception[] };

let raw: string;
try {
  raw = execFileSync("npm", ["audit", "--omit=dev", "--json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === "win32",
  });
} catch (error) {
  // npm audit exits non-zero when it finds something; the report is on stdout.
  raw = (error as { stdout?: string }).stdout ?? "";
  if (!raw) throw error;
}
const report = JSON.parse(raw) as {
  vulnerabilities?: Record<string, { severity: string; isDirect: boolean }>;
  metadata?: { vulnerabilities: Record<string, number> };
};
const today = new Date().toISOString().slice(0, 10);
const problems: string[] = [];
const found = Object.entries(report.vulnerabilities ?? {}).filter(
  ([, v]) => v.severity === "critical" || v.severity === "high",
);
for (const [name, vulnerability] of found) {
  const known = exceptions.find((e) => e.package === name);
  if (!known)
    problems.push(
      `${name}: ${vulnerability.severity} advisory with no exception. Update it or add a reasoned entry.`,
    );
  else if (known.reviewBy < today)
    problems.push(
      `${name}: the exception expired on ${known.reviewBy}; look at it again.`,
    );
}
const stale = exceptions.filter(
  (e) => !found.some(([name]) => name === e.package),
);
console.log(
  `npm audit (production): ${JSON.stringify(report.metadata?.vulnerabilities ?? {})}`,
);
for (const e of stale)
  console.log(
    `  note: the exception for ${e.package} is no longer needed; remove it.`,
  );
if (problems.length) {
  console.error(
    `Dependency audit failed:\n${problems.map((p) => `  - ${p}`).join("\n")}`,
  );
  process.exit(1);
}
console.log(
  `No unreviewed critical or high advisories (${found.length} accepted with a reason).`,
);
