/**
 * `npm run theme:new <name>`: scaffold a theme (roadmap L4). Creates
 * src/video/themes/<name>.ts from a contrast-safe starting point and adds it to
 * the registry. Then edit the palette and run the checks in
 * docs/CONTRIBUTING_SCENES.md.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const name = process.argv[2];
if (!name || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
  console.error(
    'Give a lowercase name with hyphens, for example: npm run theme:new "ocean-blue" (use ocean-blue)',
  );
  process.exit(1);
}
const dir = path.resolve("src", "video", "themes");
const file = path.join(dir, `${name}.ts`);
if (existsSync(file)) {
  console.error(`${path.relative(".", file)} already exists`);
  process.exit(1);
}
const camel = name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const title = name
  .split("-")
  .map((w) => w[0].toUpperCase() + w.slice(1))
  .join(" ");

writeFileSync(
  file,
  `import type { Theme } from "./types";

export const ${camel}: Theme = {
  id: "${name}",
  name: "${title}",
  description: "One sentence on when to use this look.",
  // Words in a storyboard that point at this theme when "theme" is "auto".
  keywords: ["replace", "with", "topic", "words"],
  palette: {
    background: "#0F172A",
    backgroundAccent: "#1E293B",
    foreground: "#F8FAFC",
    muted: "#CBD5E1",
    accent: "#38BDF8",
    accentSecondary: "#A78BFA",
    accentForeground: "#0F172A",
  },
  // Only the bundled fonts: Geist, Inter, EB Garamond, Archivo Black, JetBrains Mono.
  fonts: { heading: "Geist", body: "Inter" },
  type: { weight: 700, tracking: -0.02, uppercase: false },
  shape: { radius: 16, stroke: 2 },
  background: "glow",
  motion: "smooth",
  captionStyle: "pop",
  musicMood: "light ambient",
};
`,
);

const indexPath = path.join(dir, "index.ts");
let index = readFileSync(indexPath, "utf8");
index = index.replace(
  'import type { Theme } from "./types";',
  `import { ${camel} } from "./${name}";\nimport type { Theme } from "./types";`,
);
index = index.replace(
  /(export const THEMES: readonly Theme\[\] = \[[\s\S]*?)(\n\];)/,
  `$1\n  ${camel},$2`,
);
writeFileSync(indexPath, index);
console.log(`Created ${path.relative(".", file)} and registered it.`);
console.log(
  "Next: edit the palette, then npx vitest run src/video/themes and node scripts/theme-sheet.mjs",
);
