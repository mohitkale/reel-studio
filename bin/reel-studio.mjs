#!/usr/bin/env node
// Runs the TypeScript command line straight from the source tree.
import { fileURLToPath } from "node:url";
import { configureInstalledEnvironment } from "../scripts/installed-environment.mjs";

const [major, minor] = process.versions.node.split(".").map(Number);
if (major !== 24 || minor < 15) {
  console.error(
    `Reel Studio requires Node.js 24.15 or newer within Node 24 LTS (found ${process.version}).`,
  );
  process.exit(3);
}
const installed = configureInstalledEnvironment(
  fileURLToPath(new URL("../", import.meta.url)),
);

const { main } = installed
  ? await import("../src/cli/main.mjs")
  : await (
      await import("tsx/esm/api")
    ).tsImport("../src/cli/main.ts", {
      parentURL: import.meta.url,
      tsconfig: fileURLToPath(new URL("../tsconfig.json", import.meta.url)),
    });
process.exit(await main(process.argv.slice(2), { installed }));
