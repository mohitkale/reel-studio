/**
 * `npm run storyboard:freeze`: move the frozen Storyboard v1 baseline forward to
 * the current schema (roadmap L6). Allowed only when the change is additive:
 * the current schema must still accept everything the frozen one does. Run it
 * after adding a field or an enum value, so later changes are checked against
 * the newest contract. The golden corpus only ever gains files; never edit one.
 */
import { copyFileSync, readFileSync } from "node:fs";
import path from "node:path";

import { breakingChanges } from "../src/storyboard/schema-compat";
import { storyboardJsonSchema } from "../src/storyboard/schema";

const frozen = path.resolve("tests/fixtures/storyboard-v1/frozen.schema.json");
const problems = breakingChanges(
  JSON.parse(readFileSync(frozen, "utf8")),
  storyboardJsonSchema(),
);
if (problems.length) {
  console.error(
    `Storyboard v1 is frozen and this change is not additive:\n${problems.map((p) => `  ${p}`).join("\n")}\nMake it additive, or it needs a Storyboard v2.`,
  );
  process.exit(1);
}
copyFileSync(path.resolve("schemas/storyboard.v1.json"), frozen);
console.log("The frozen baseline now matches schemas/storyboard.v1.json.");
