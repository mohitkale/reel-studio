/**
 * `npm run licensing:check`: is the licence inventory current? (roadmap L6)
 *
 * It looks at what the repository really ships and fails when something is not
 * covered in `docs/LICENSING.md`:
 *   - every bundled font family (public/reel-runtime) has an OFL notice and is named;
 *   - bundled music, icons, GSAP, the presenters, FFmpeg and the GPL phonemizer are named;
 *   - every non-development dependency with a licence that is not plainly permissive
 *     (LGPL, GPL, EPL, CC-BY, undeclared, custom) is named in the document.
 * New findings are fixed by adding a row to LICENSING.md, never by loosening this.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { MUSIC_LIBRARY } from "../src/lib/music-library";

const root = process.cwd();
const doc = readFileSync(path.join(root, "docs/LICENSING.md"), "utf8");
const text = doc.toLowerCase();
const problems: string[] = [];
const mentions = (needle: string) => text.includes(needle.toLowerCase());
const need = (needle: string, why: string) => {
  if (!mentions(needle))
    problems.push(`LICENSING.md does not mention "${needle}" (${why})`);
};

// Fonts: one notice per family, each OFL, each named in the document.
const runtime = path.join(root, "public/reel-runtime");
const notices = readdirSync(runtime).filter((f) =>
  /^fontsource-.*-LICENSE\.txt$/.test(f),
);
if (notices.length < 6)
  problems.push(
    `Expected six font notices in public/reel-runtime, found ${notices.length}`,
  );
for (const file of notices) {
  const family = file
    .replace(/^fontsource-(variable-)?/, "")
    .replace(/-LICENSE\.txt$/, "")
    .replace(/-/g, " ");
  if (
    !/SIL Open Font License/i.test(
      readFileSync(path.join(runtime, file), "utf8"),
    )
  )
    problems.push(`${file} is not an OFL notice; check the font's licence`);
  need(family, "a bundled font family");
}
need("OFL", "the font licence");

// Music: the number of bundled tracks must match what the document says.
const tracks = readdirSync(path.join(root, "public/music")).filter((f) =>
  f.endsWith(".wav"),
).length;
if (tracks !== MUSIC_LIBRARY.length)
  problems.push(
    `public/music has ${tracks} tracks but the library lists ${MUSIC_LIBRARY.length}`,
  );
const words: Record<number, string> = {
  10: "ten",
  12: "twelve",
  15: "fifteen",
  16: "sixteen",
  18: "eighteen",
  20: "twenty",
  24: "twenty-four",
  25: "twenty-five",
  30: "thirty",
};
if (!mentions(`${words[tracks] ?? tracks} tracks`))
  problems.push(
    `LICENSING.md should say how many bundled tracks there are (${tracks}: "${words[tracks] ?? tracks} tracks")`,
  );
need("CC0", "bundled music");

// Other bundled or fetched components.
if (existsSync(path.join(runtime, "gsap.min.js")))
  need("GSAP", "bundled animation runtime");
if (
  existsSync(path.join(root, "src/engines/hyperframes/assets/lucide-icons.ts"))
)
  need("lucide", "bundled icons");
if (existsSync(path.join(root, "src/engines/hyperframes/presenter")))
  need("Presenter characters", "bundled artwork");
if (existsSync(path.join(root, "vendor/phonemizer"))) {
  need("GPL-3.0-or-later", "the vendored phonemizer engine");
  need("corresponding source", "GPL source provision");
}
need("FFmpeg", "a program fetched by doctor --fix");

// Dependencies whose licence is not plainly permissive must be named.
const PERMISSIVE =
  /^(MIT|ISC|0BSD|Apache-2\.0|BSD-[23]-Clause|BlueOak-1\.0\.0|Unlicense|OFL-1\.1|CC0-1\.0|WTFPL)$/;
const lock = JSON.parse(
  readFileSync(path.join(root, "package-lock.json"), "utf8"),
) as {
  packages: Record<
    string,
    {
      license?: string;
      dev?: boolean;
      link?: boolean;
      resolved?: string;
      version?: string;
    }
  >;
};
const unusual = new Map<string, Set<string>>();
for (const [location, pkg] of Object.entries(lock.packages)) {
  if (!location || pkg.dev) continue;
  const meta = pkg.link ? (lock.packages[pkg.resolved ?? ""] ?? pkg) : pkg;
  const license = meta.license ?? "UNDECLARED";
  const simple = license.replace(/[()]/g, "").split(/\s+(?:AND|OR|and)\s+/);
  if (simple.every((l) => PERMISSIVE.test(l.trim()))) continue;
  const name = location.split("node_modules/").pop()!;
  // Platform binaries of one package are one entry: @img/sharp-libvips-linux-x64 -> @img/sharp-libvips.
  const family = name.replace(
    /-(darwin|linux|linuxmusl|win32|wasm32)(-[a-z0-9]+)?$/,
    "",
  );
  (unusual.get(family) ?? unusual.set(family, new Set()).get(family)!).add(
    license,
  );
}
for (const [family, licenses] of unusual) {
  const short = family.replace(/^@[^/]+\//, "");
  const named =
    mentions(family) ||
    mentions(short) ||
    (family.startsWith("@img/sharp") && mentions("libvips"));
  if (!named)
    problems.push(
      `${family} (${[...licenses].join(", ")}) is shipped but not named in LICENSING.md`,
    );
}

if (problems.length) {
  console.error(
    `Licence inventory is out of date:\n${problems.map((p) => `  - ${p}`).join("\n")}\nAdd a row to docs/LICENSING.md.`,
  );
  process.exit(1);
}
console.log(
  `Licence inventory current: ${notices.length} font families, ${tracks} music tracks, ${unusual.size} dependency families with non-permissive or undeclared licences all named.`,
);
