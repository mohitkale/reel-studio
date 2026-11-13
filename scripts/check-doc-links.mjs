#!/usr/bin/env node
/**
 * Link check for every tracked Markdown file: relative file links, images and
 * #anchors must resolve. External URLs are not fetched.
 *
 *   npm run docs:links
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const files = execFileSync("git", ["ls-files", "*.md"], {
  cwd: root,
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean)
  .filter((f) => existsSync(path.join(root, f)));

/** GitHub-style heading slug. */
function slug(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/`/g, "")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

function stripCode(text) {
  return text.replace(/^(```|~~~)[\s\S]*?^\1/gm, "").replace(/`[^`\n]*`/g, "");
}

const anchorCache = new Map();
function anchorsOf(file) {
  if (!anchorCache.has(file)) {
    const set = new Set();
    const counts = new Map();
    for (const line of stripCode(readFileSync(file, "utf8")).split("\n")) {
      const m = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
      if (!m) continue;
      const base = slug(m[1]);
      const n = counts.get(base) ?? 0;
      counts.set(base, n + 1);
      set.add(n === 0 ? base : `${base}-${n}`);
    }
    for (const m of readFileSync(file, "utf8").matchAll(
      /<a\s+(?:name|id)="([^"]+)"/g,
    )) {
      set.add(m[1]);
    }
    anchorCache.set(file, set);
  }
  return anchorCache.get(file);
}

const problems = [];
let checked = 0;
for (const rel of files) {
  const file = path.join(root, rel);
  const text = stripCode(readFileSync(file, "utf8"));
  const links = [
    ...text.matchAll(/!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g),
  ].map((m) => m[1]);
  for (const m of text.matchAll(/^\s*\[[^\]]+\]:\s*(\S+)/gm)) links.push(m[1]);
  for (const link of links) {
    if (/^(https?:|mailto:|tel:|data:)/i.test(link)) continue;
    checked += 1;
    const [target, hash] = link.split("#");
    let resolved = file;
    if (target) {
      resolved = path.resolve(path.dirname(file), decodeURI(target));
      if (!existsSync(resolved)) {
        problems.push(`${rel}: missing file for link ${link}`);
        continue;
      }
    }
    if (hash && /\.md$/i.test(resolved) && statSync(resolved).isFile()) {
      if (!anchorsOf(resolved).has(decodeURI(hash).toLowerCase())) {
        problems.push(`${rel}: missing anchor in link ${link}`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`Doc links FAILED (${problems.length} problems):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(
  `Doc links OK: ${checked} relative links in ${files.length} files.`,
);
