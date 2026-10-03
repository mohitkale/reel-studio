import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
const [revision, compiler, source] = process.argv.slice(2);
if (
  revision !== "0dfd1d77dd7f96ef1ea6856c9fa5cfac01599582" ||
  !compiler.includes("3.1.30")
)
  throw new Error("Unexpected source/compiler");
const compilerRevision = execFileSync(
  "git",
  ["-C", process.env.EMSDK, "rev-parse", "HEAD"],
  { encoding: "utf8" },
).trim();
if (compilerRevision !== "91f8563a9d1a4a0ec03bbb2be23485367d85a091")
  throw new Error("Unexpected emsdk revision");
const hash = async (file) =>
  createHash("sha256")
    .update(await fs.readFile(file))
    .digest("hex");
await fs.copyFile(
  path.join(process.env.EMSDK, "upstream/emscripten/LICENSE"),
  "vendor/phonemizer/COPYING.EMSCRIPTEN",
);
const manifest = {
  version: 1,
  source: { repository: "https://github.com/espeak-ng/espeak-ng", revision },
  compiler: {
    version: "3.1.30",
    emsdkRevision: compilerRevision,
    description: compiler,
  },
  files: Object.fromEntries(
    await Promise.all(
      [
        "vendor/phonemizer/engine.js",
        "vendor/phonemizer/index.js",
        "vendor/phonemizer/reel-phonemizer.c",
        "scripts/build-phonemizer.sh",
      ].map(async (file) => [file, await hash(file)]),
    ),
  ),
  data: "Built from the same pinned source; no model weights bundled",
};
await fs.writeFile(
  "vendor/phonemizer/provenance.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
const output = ".artifacts/phonemizer-source";
await fs.mkdir(output, { recursive: true });
const upstreamArchive = path.resolve(output, "espeak-ng.tar");
execFileSync("git", [
  "-C",
  source,
  "archive",
  "--format=tar",
  "--prefix=espeak-ng/",
  `--output=${upstreamArchive}`,
  revision,
]);
execFileSync("tar", ["-xf", upstreamArchive, "-C", output]);
await fs.rm(upstreamArchive);
await fs.mkdir(path.join(output, "reel-studio/scripts"), { recursive: true });
await fs.cp(
  "vendor/phonemizer",
  path.join(output, "reel-studio/vendor/phonemizer"),
  { recursive: true, filter: (file) => !file.endsWith("engine.js") },
);
for (const file of [
  "build-phonemizer.sh",
  "phonemizer-provenance.mjs",
  "verify-phonemizer.mjs",
])
  await fs.copyFile(
    `scripts/${file}`,
    path.join(output, "reel-studio/scripts", file),
  );
await fs.mkdir(path.join(output, "reel-studio/tests/fixtures/release-v030"), {
  recursive: true,
});
await fs.copyFile(
  "tests/fixtures/release-v030/phonemizer-1.2.1.json",
  path.join(
    output,
    "reel-studio/tests/fixtures/release-v030/phonemizer-1.2.1.json",
  ),
);
// Include the compiler runtime/library sources that are embedded in the engine.
for (const directory of ["src", "system/lib", "system/include"]) {
  await fs.cp(
    path.join(process.env.EMSDK, "upstream/emscripten", directory),
    path.join(output, "emscripten-runtime", directory),
    { recursive: true },
  );
}
await fs.copyFile(
  path.join(process.env.EMSDK, "upstream/emscripten/LICENSE"),
  path.join(output, "emscripten-runtime/LICENSE"),
);
await fs.copyFile(
  ".github/workflows/phonemizer-source.yml",
  path.join(output, "reel-studio/build-workflow.yml"),
);
execFileSync("tar", [
  "-czf",
  ".artifacts/reel-phonemizer-corresponding-source.tar.gz",
  "-C",
  output,
  ".",
]);
console.log(
  "Pinned engine and complete corresponding-source archive generated.",
);
