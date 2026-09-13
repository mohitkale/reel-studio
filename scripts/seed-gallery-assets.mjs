#!/usr/bin/env node
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, "docs", "assets", "examples");
const destination = path.join(root, "media", "gallery");
const files = [
  "portrait-demo.mp4",
  "portrait-demo.jpg",
  "landscape-demo.mp4",
  "landscape-demo.jpg",
  "square-demo.mp4",
  "square-demo.jpg",
  "podcast-demo.mp3",
];

function checksum(filename) {
  return createHash("sha256").update(readFileSync(filename)).digest("hex");
}

mkdirSync(destination, { recursive: true });
for (const name of files) {
  const from = path.join(source, name);
  const to = path.join(destination, name);
  if (!existsSync(from)) {
    throw new Error(`Bundled gallery asset is missing: ${from}`);
  }
  if (existsSync(to) && checksum(from) === checksum(to)) {
    console.log(`✓ ${name}`);
    continue;
  }
  copyFileSync(from, to);
  console.log(`✓ Installed ${name}`);
}

console.log("Gallery assets are ready under media/gallery/.");
