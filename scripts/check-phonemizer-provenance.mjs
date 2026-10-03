/** Distribution gate; no model downloads or compiler execution. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
export async function checkPhonemizerProvenance({ distribution = false } = {}) {
  const root = process.cwd(),
    manifest = JSON.parse(
      await fs.readFile("vendor/phonemizer/provenance.json", "utf8"),
    );
  assert.equal(manifest.version, 1);
  assert.equal(
    manifest.source.repository,
    "https://github.com/espeak-ng/espeak-ng",
  );
  assert.equal(
    manifest.source.revision,
    "0dfd1d77dd7f96ef1ea6856c9fa5cfac01599582",
  );
  assert.equal(manifest.compiler.version, "3.1.30");
  assert.equal(
    manifest.compiler.emsdkRevision,
    "91f8563a9d1a4a0ec03bbb2be23485367d85a091",
  );
  const expected = [
    "vendor/phonemizer/engine.js",
    "vendor/phonemizer/index.js",
    "vendor/phonemizer/reel-phonemizer.c",
    "scripts/build-phonemizer.sh",
  ];
  assert.deepEqual(Object.keys(manifest.files).sort(), expected.toSorted());
  for (const file of expected) {
    assert.match(manifest.files[file], /^[a-f0-9]{64}$/);
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(path.join(root, file)))
      hash.update(chunk);
    assert.equal(
      hash.digest("hex"),
      manifest.files[file],
      `Phonemizer provenance drift: ${file}`,
    );
  }
  for (const name of [
    "COPYING",
    "COPYING.APACHE",
    "COPYING.BSD2",
    "COPYING.UCD",
    "COPYING.EMSCRIPTEN",
    "NOTICE",
    "LICENSE.adapter",
  ])
    assert.ok(
      (await fs.stat(`vendor/phonemizer/${name}`)).size > 100,
      `Missing notice ${name}`,
    );
  const pkg = JSON.parse(
    await fs.readFile("vendor/phonemizer/package.json", "utf8"),
  );
  assert.equal(pkg.version, "1.2.1-reel.1");
  assert.equal(pkg.license, "GPL-3.0-or-later");
  if (distribution) {
    const entries = execFileSync(
      "tar",
      ["-tzf", ".artifacts/reel-phonemizer-corresponding-source.tar.gz"],
      { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
    ).split("\n");
    assert.ok(
      entries.every(
        (entry) => !entry.startsWith("/") && !entry.split("/").includes(".."),
      ),
      "Unsafe source archive path",
    );
    for (const required of [
      "espeak-ng/COPYING",
      "espeak-ng/src/libespeak-ng/translate.c",
      "reel-studio/vendor/phonemizer/reel-phonemizer.c",
      "reel-studio/vendor/phonemizer/index.js",
      "reel-studio/scripts/build-phonemizer.sh",
      "emscripten-runtime/LICENSE",
    ])
      assert.ok(
        entries.some((entry) => entry.replace(/^\.\//, "") === required),
        `Missing corresponding source ${required}`,
      );
    const archived = (name) => {
      const entry = entries.find(
        (value) => value.replace(/^\.\//, "") === name,
      );
      assert.ok(entry, `Missing archived input ${name}`);
      return execFileSync(
        "tar",
        [
          "-xOf",
          ".artifacts/reel-phonemizer-corresponding-source.tar.gz",
          entry,
        ],
        { maxBuffer: 8 * 1024 * 1024 },
      );
    };
    assert.deepEqual(
      JSON.parse(
        archived("reel-studio/vendor/phonemizer/provenance.json").toString(
          "utf8",
        ),
      ),
      manifest,
      "Source archive does not match the distributed engine",
    );
    for (const file of expected.filter(
      (value) => !value.endsWith("engine.js"),
    )) {
      assert.equal(
        createHash("sha256")
          .update(archived(`reel-studio/${file}`))
          .digest("hex"),
        manifest.files[file],
        `Archived build input drift: ${file}`,
      );
    }
    assert.deepEqual(
      archived("espeak-ng/COPYING"),
      await fs.readFile("vendor/phonemizer/COPYING"),
    );
    assert.deepEqual(
      archived("emscripten-runtime/LICENSE"),
      await fs.readFile("vendor/phonemizer/COPYING.EMSCRIPTEN"),
    );
  }
  return {
    engineSha256: manifest.files["vendor/phonemizer/engine.js"],
    sourceRevision: manifest.source.revision,
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await checkPhonemizerProvenance({
    distribution: process.argv.includes("--distribution"),
  });
  console.log(
    "Phonemizer source/build hashes, licenses and source provision verified.",
  );
}
