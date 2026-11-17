#!/usr/bin/env node
// Runs the TypeScript command line straight from the source tree.
import { tsImport } from "tsx/esm/api";
import { fileURLToPath } from "node:url";

const { main } = await tsImport("../src/cli/main.ts", {
  parentURL: import.meta.url,
  tsconfig: fileURLToPath(new URL("../tsconfig.json", import.meta.url)),
});
process.exit(await main(process.argv.slice(2)));
