#!/usr/bin/env node
/**
 * Setup (if needed) then start the Next.js app for a first demo run.
 */

import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const setup = spawnSync(process.execPath, [join(root, "scripts/setup.mjs")], {
  cwd: root,
  stdio: "inherit",
});
if (setup.status !== 0) process.exit(setup.status ?? 1);

console.log("\n→ Starting Reel Studio at http://localhost:3000\n");
const child = spawn("npm", ["run", "dev"], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});
child.on("exit", (code) => process.exit(code ?? 0));
