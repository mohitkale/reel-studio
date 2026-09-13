#!/usr/bin/env node
/** Freeze direct dependency targets without installing or changing the lockfile. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const packages = [];
for (const group of ["dependencies", "devDependencies"]) {
  for (const [name, declared] of Object.entries(pkg[group] ?? {})) {
    packages.push({ name, group, declared });
  }
}
let cursor = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (cursor < packages.length) {
    const row = packages[cursor++];
    const { stdout } = await run("npm", ["view", `${row.name}@latest`, "version", "engines", "peerDependencies", "repository", "--json", "--fetch-retries=0", "--fetch-timeout=20000"], { timeout: 30000 });
    let meta = JSON.parse(stdout);
    let latest = typeof meta === "string" ? meta : meta.version;
    if (latest?.includes("-")) {
      const versions = JSON.parse((await run("npm", ["view", row.name, "versions", "--json", "--fetch-retries=0", "--fetch-timeout=20000"], { timeout: 30000, maxBuffer: 8 * 1024 * 1024 })).stdout);
      latest = versions.filter((v) => /^\d+\.\d+\.\d+$/.test(v)).sort((a, b) => {
        const aa = a.split(".").map(Number), bb = b.split(".").map(Number);
        return aa[0] - bb[0] || aa[1] - bb[1] || aa[2] - bb[2];
      }).at(-1);
      meta = JSON.parse((await run("npm", ["view", `${row.name}@${latest}`, "version", "engines", "peerDependencies", "repository", "--json", "--fetch-retries=0", "--fetch-timeout=20000"], { timeout: 30000 })).stdout);
    }
    if (!latest || latest.includes("-")) throw new Error(`Non-stable target: ${row.name}`);
    Object.assign(row, {
      installed: lock.packages[`node_modules/${row.name}`]?.version ?? null,
      latest,
      engines: meta.engines ?? {},
      peers: meta.peerDependencies ?? {},
      repository: meta.repository ?? null,
    });
  }
}));
await mkdir("docs/production", { recursive: true });
await writeFile("docs/production/dependencies.json", JSON.stringify({ capturedAt: new Date().toISOString(), node: process.version, packages }, null, 2) + "\n");
console.log(`Recorded ${packages.length} stable dependency targets.`);
