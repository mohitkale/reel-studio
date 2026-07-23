#!/usr/bin/env node
/**
 * Idempotent first-run setup for Reel Studio.
 * Does not overwrite an existing .env.local or wipe the database.
 */

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envExample = join(root, ".env.example");
const envLocal = join(root, ".env.local");

function run(cmd, args, label) {
  console.log(`\n→ ${label}`);
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    console.error(`\nSetup failed during: ${label}`);
    process.exit(result.status ?? 1);
  }
}

const major = Number(process.versions.node.split(".")[0]);
if (!Number.isFinite(major) || major < 22) {
  console.error(
    `Node.js 22+ is required (found ${process.version}). Use \`nvm use\` or upgrade Node.`,
  );
  process.exit(1);
}
console.log(`✓ Node ${process.version}`);

if (!existsSync(envLocal)) {
  if (!existsSync(envExample)) {
    console.error("Missing .env.example — cannot create .env.local");
    process.exit(1);
  }
  copyFileSync(envExample, envLocal);
  console.log("✓ Created .env.local from .env.example (empty optional keys)");
} else {
  console.log("✓ .env.local already present (left unchanged)");
}

run("npx", ["prisma", "generate"], "Generate Prisma client");
run("npx", ["prisma", "db", "push"], "Initialize SQLite database");
run("npx", ["tsx", "scripts/seed-demo-brandkit.ts"], "Seed Coral Harbor brand kit");
run("npx", ["tsx", "scripts/seed-demo-project.ts"], "Seed demo video project");
run("npx", ["tsx", "scripts/seed-demo-podcast.ts"], "Seed demo podcast");

const withAssets = process.argv.includes("--assets");
if (withAssets) {
  run("npx", ["tsx", "scripts/seed-assets.ts"], "Seed sample assets");
}

console.log(`
Setup complete.

Next:
  npm run dev
  Open http://localhost:3000

Optional:
  npm run setup -- --assets   # also seed sample SVG/Lottie assets
  npm run demo                # setup + start the app

No cloud API keys are required for the HyperFrames demo project or Kokoro voices.
`);
