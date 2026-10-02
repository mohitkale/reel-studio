/** Rebuild the vendored browser/export runtime from installed, locked packages. */
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
const root = path.resolve("public/reel-runtime");
await mkdir(root, { recursive: true });
const groups = [
  ["@fontsource-variable/geist", ["index.css", "wght-italic.css"]],
  ["@fontsource-variable/geist-mono", ["index.css", "wght-italic.css"]],
  [
    "@fontsource/eb-garamond",
    ["400.css", "700.css", "400-italic.css", "700-italic.css"],
  ],
  ["@fontsource/inter", ["400.css", "700.css"]],
  ["@fontsource/archivo-black", ["400.css"]],
  ["@fontsource/jetbrains-mono", ["400.css", "700.css"]],
];
const rules = [];
const files = new Set();
const sources = [];
for (const [name, sheets] of groups) {
  const directory = path.resolve("node_modules", name);
  const pkg = JSON.parse(
    await readFile(path.join(directory, "package.json"), "utf8"),
  );
  const licenseName =
    name.replaceAll("/", "-").replace("@", "") + "-LICENSE.txt";
  await copyFile(path.join(directory, "LICENSE"), path.join(root, licenseName));
  sources.push({
    package: name,
    version: pkg.version,
    license: pkg.license,
    notice: licenseName,
  });
  for (const sheet of sheets) {
    const css = await readFile(path.join(directory, sheet), "utf8");
    for (const match of css.matchAll(/@font-face\s*\{([^}]+)\}/g)) {
      const filename = match[1].match(/\.\/files\/([^')]+\.woff2)/)?.[1];
      if (!filename) throw new Error(`Missing WOFF2 in ${name}/${sheet}`);
      await copyFile(
        path.join(directory, "files", filename),
        path.join(root, filename),
      );
      files.add(filename);
      rules.push(
        ("@font-face{" + match[1] + "}")
          .replace(
            /src:[^;]+;/,
            `src:url(__RUNTIME__/${filename}) format('woff2');`,
          )
          .replaceAll("Geist Variable", "Geist")
          .replaceAll("Geist Mono Variable", "Geist Mono")
          .replace("font-display: swap", "font-display: block"),
      );
    }
  }
}
await copyFile(
  "node_modules/gsap/dist/gsap.min.js",
  path.join(root, "gsap.min.js"),
);
const gsap = JSON.parse(
  await readFile("node_modules/gsap/package.json", "utf8"),
);
sources.push({
  package: "gsap",
  version: gsap.version,
  license: gsap.license,
  notice: "https://gsap.com/community/standard-license/",
});
const assets = [];
for (const filename of [...files, "gsap.min.js"])
  assets.push({
    filename,
    sha256: createHash("sha256")
      .update(await readFile(path.join(root, filename)))
      .digest("hex"),
  });
await writeFile(
  path.join(root, "manifest.json"),
  JSON.stringify({ sources, assets, fontCss: rules.join("\n") }, null, 2) +
    "\n",
);
console.log(
  `Vendored ${files.size} OFL font files and GSAP ${gsap.version}; no downloads.`,
);
