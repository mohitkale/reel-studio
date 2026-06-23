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

const rules = [
  {
    name: "Private key material",
    pattern: /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/g,
  },
  {
    name: "GitHub token",
    pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  },
  {
    name: "Google API key",
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
  },
  {
    name: "OpenAI-style key",
    pattern: /\bsk-[A-Za-z0-9]{20,}\b/g,
  },
  {
    name: "Cartesia-style key",
    pattern: /\bsk_car_[A-Za-z0-9]{20,}\b/g,
  },
  {
    name: "Slack token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  },
  {
    name: "Assigned provider key value",
    pattern:
      /(?:CARTESIA_API_KEY|ELEVENLABS_API_KEY|GEMINI_API_KEY|OPENAI_API_KEY)\s*=\s*["']?[A-Za-z0-9._:-]{12,}/g,
  },
];

const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);

const findings = [];

for (const file of tracked) {
  const ext = path.extname(file).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) continue;

  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    let match;
    while ((match = rule.pattern.exec(content)) !== null) {
      const before = content.slice(0, match.index);
      const line = before.split(/\r?\n/).length;
      findings.push({
        file,
        line,
        rule: rule.name,
        snippet: match[0].slice(0, 80),
      });
    }
  }
}

if (findings.length > 0) {
  console.error("Secret scan failed. Potential secrets found in tracked files:\n");
  for (const finding of findings) {
    console.error(
      `- ${finding.file}:${finding.line} | ${finding.rule} | ${finding.snippet}`,
    );
  }
  process.exit(1);
}

console.log("Secret scan passed. No obvious secrets found in tracked files.");
