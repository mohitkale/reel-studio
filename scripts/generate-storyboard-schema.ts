/**
 * Writes the generated storyboard files from the Zod schema and the writer prompt:
 *   schemas/storyboard.v1.json          the published JSON Schema
 *   docs/prompts/storyboard-writer.md   the prompt for pasting into any chat app
 *
 *   npm run storyboard:schema            write the files
 *   npm run storyboard:schema -- --check fail if a checked-in file is stale
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { storyboardWriterPromptDocument } from "../src/providers/ai/storyboard-doc";
import { storyboardJsonSchema } from "../src/storyboard/schema";

const root = path.resolve(import.meta.dirname, "..");
const files: Array<[string, string]> = [
  [
    path.join(root, "schemas", "storyboard.v1.json"),
    `${JSON.stringify(storyboardJsonSchema(), null, 2)}\n`,
  ],
  [
    path.join(root, "docs", "prompts", "storyboard-writer.md"),
    storyboardWriterPromptDocument(),
  ],
];

const check = process.argv.includes("--check");
let stale = false;
for (const [target, text] of files) {
  const relative = path.relative(root, target);
  if (check) {
    if (!existsSync(target) || readFileSync(target, "utf8") !== text) {
      console.error(
        `${relative} is stale. Run \`npm run storyboard:schema\` and commit the result.`,
      );
      stale = true;
    }
  } else {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, text);
    console.log(`Wrote ${relative}`);
  }
}
if (check) {
  if (stale) process.exit(1);
  console.log("Generated storyboard files are up to date.");
}
