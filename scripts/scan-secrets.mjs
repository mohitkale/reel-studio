import { scanSecretText } from "./secret-patterns.mjs";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".mp4",
  ".mov",
  ".wav",
  ".ico",
  ".pdf",
  ".zip",
  ".gz",
  ".tgz",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
]);

const staged = process.argv.includes("--staged");
const tracked = execFileSync(
  "git",
  staged
    ? ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]
    : ["ls-files", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);

const findings = [];

for (const file of tracked) {
  const ext = path.extname(file).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) continue;

  let content;
  try {
    content = staged
      ? execFileSync("git", ["show", `:${file}`], {
          encoding: "utf8",
          maxBuffer: 32 * 1024 * 1024,
        })
      : readFileSync(file, "utf8");
  } catch (error) {
    if (!staged && error.code === "ENOENT") continue;
    console.error(`Secret scan could not read ${file}; scan failed.`);
    process.exit(1);
  }

  for (const finding of scanSecretText(content))
    findings.push({ file, ...finding });
}

if (findings.length > 0) {
  console.error(
    `Secret scan failed. Potential secrets found in ${staged ? "staged" : "tracked"} files:\n`,
  );
  for (const finding of findings) {
    console.error(
      `- ${finding.file}:${finding.line} | ${finding.rule} | [redacted]`,
    );
  }
  process.exit(1);
}

console.log("Secret scan passed. No obvious secrets found.");
