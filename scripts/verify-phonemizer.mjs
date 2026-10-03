import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const installed = process.argv.includes("--built-source")
  ? "vendor/phonemizer/index.js"
  : createRequire(createRequire(import.meta.url).resolve("kokoro-js")).resolve(
      "phonemizer",
    );
assert.equal(
  await fs.realpath(installed),
  await fs.realpath("vendor/phonemizer/index.js"),
);
const { phonemize, list_voices } = await import(pathToFileURL(installed).href);
const golden = JSON.parse(
  await fs.readFile(
    "tests/fixtures/release-v030/phonemizer-1.2.1.json",
    "utf8",
  ),
);
assert.deepEqual(await list_voices(), golden.voices);
const mismatches = [];
for (const item of golden.cases) {
  const actual = await phonemize(item.text, item.language);
  if (JSON.stringify(actual) !== JSON.stringify(item.phonemes))
    mismatches.push({ ...item, actual });
}
await fs.mkdir(".artifacts", { recursive: true });
await fs.writeFile(
  ".artifacts/m15-phonemizer-comparison.json",
  JSON.stringify(
    { cases: golden.cases.length, voices: golden.voices.length, mismatches },
    null,
    2,
  ),
);
assert.deepEqual(mismatches, []);
console.log(
  "Original phonemes and English voice metadata match the source-built engine.",
);
