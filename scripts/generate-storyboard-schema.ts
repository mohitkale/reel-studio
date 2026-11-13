/**
 * Writes schemas/storyboard.v1.json from the Zod schema.
 *
 *   npm run storyboard:schema            write the file
 *   npm run storyboard:schema -- --check fail if the checked-in file is stale
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { storyboardJsonSchema } from "../src/storyboard/schema";

const target = path.resolve(
  import.meta.dirname,
  "..",
  "schemas",
  "storyboard.v1.json",
);
const text = `${JSON.stringify(storyboardJsonSchema(), null, 2)}\n`;

if (process.argv.includes("--check")) {
  if (!existsSync(target) || readFileSync(target, "utf8") !== text) {
    console.error(
      "schemas/storyboard.v1.json is stale. Run `npm run storyboard:schema` and commit the result.",
    );
    process.exit(1);
  }
  console.log("schemas/storyboard.v1.json is up to date.");
} else {
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, text);
  console.log(`Wrote ${path.relative(process.cwd(), target)}`);
}
