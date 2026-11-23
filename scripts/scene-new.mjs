/**
 * `npm run scene:new <name>`: scaffold a scene type (roadmap L4).
 *
 * Creates `src/engines/hyperframes/scenes/<name>/index.ts` (a list-of-items scene
 * with its own styles and a sample) and `index.test.ts`, then makes the few
 * one-line registrations that tie the type into the storyboard format, the plan,
 * the exporter and the tests. Every edit is checked before anything is written,
 * so a failure changes nothing. Then edit `build()` and `css` in your folder and
 * run `npm run scene:preview <name>`. See docs/CONTRIBUTING_SCENES.md.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const name = process.argv[2];
if (!name || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
  console.error(
    "Give a lowercase name with hyphens, for example: npm run scene:new quick-tip",
  );
  process.exit(1);
}
const camel = name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const title = name
  .split("-")
  .map((w) => w[0].toUpperCase() + w.slice(1))
  .join(" ");
const folder = path.resolve("src/engines/hyperframes/scenes", name);
if (existsSync(folder)) {
  console.error(`${path.relative(".", folder)} already exists`);
  process.exit(1);
}

/** Insert next to built-in lines that remain in place after each addition. */
const edits = [
  {
    file: "src/engines/hyperframes/scenes/registry.ts",
    find: 'import { timeline } from "./timeline";\n',
    to: `import { timeline } from "./timeline";\nimport { ${camel} } from "./${name}";\n`,
  },
  {
    file: "src/engines/hyperframes/scenes/registry.ts",
    find: "  recap,\n",
    to: `  recap,\n  ${camel},\n`,
  },
  {
    file: "src/storyboard/schema.ts",
    find: '  "recap",\n',
    to: `  "recap",\n  "${name}",\n`,
  },
  {
    file: "src/storyboard/schema.ts",
    find: ' Example: "statement".',
    to: ` ${name}: ${title}, 2-6 short items (needs items). Example: "statement".`,
  },
  {
    file: "src/storyboard/schema.ts",
    find: '      recap: "items",\n',
    to: `      recap: "items",\n      "${name}": "items",\n`,
  },
  {
    file: "src/production/storyboard-plan.ts",
    find: '    recap: "hf-recap",\n',
    to: `    recap: "hf-recap",\n    "${name}": "hf-${name}",\n`,
  },
  {
    file: "src/production/storyboard-plan.ts",
    find: '  recap: "summary",\n',
    to: `  recap: "summary",\n  "${name}": "summary",\n`,
  },
  {
    file: "src/production/storyboard-plan.ts",
    find: '      case "recap":\n        panel = { items: scene.items };',
    to: `      case "${name}":\n      case "recap":\n        panel = { items: scene.items };`,
  },
  {
    file: "src/library/project-storyboard.ts",
    find: '        case "recap":\n          out.items = data.items;',
    to: `        case "${name}":\n        case "recap":\n          out.items = data.items;`,
  },
  {
    file: "src/engines/hyperframes/scenes/registry.test.ts",
    find: "      recap: (p) => ({ items: p.items }),\n",
    to: `      recap: (p) => ({ items: p.items }),\n      "${name}": (p) => ({ items: p.items }),\n`,
  },
  {
    file: "scripts/scene-sheet.mjs",
    find: "  recap: (p) => ({ items: p.items }),\n",
    to: `  recap: (p) => ({ items: p.items }),\n  "${name}": (p) => ({ items: p.items }),\n`,
  },
];

// Check every anchor first; write only when all are found.
const contents = new Map();
const originals = new Map();
for (const edit of edits) {
  if (!contents.has(edit.file)) {
    const text = readFileSync(path.resolve(edit.file), "utf8");
    originals.set(edit.file, text);
    contents.set(edit.file, text);
  }
  const text = contents.get(edit.file);
  if (!text.includes(edit.find)) {
    console.error(
      `Cannot register "${name}": ${edit.file} no longer contains\n${edit.find}\nNothing was changed. Update scripts/scene-new.mjs to the new code, or make the registration by hand (docs/CONTRIBUTING_SCENES.md).`,
    );
    process.exit(1);
  }
  contents.set(edit.file, text.replace(edit.find, edit.to));
}
try {
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    path.join(folder, "index.ts"),
    `import { z } from "zod";

import type { SceneDefinition } from "../types";
import { px } from "../units";

// What a storyboard supplies for this scene: 2 to 6 short lines in \`items\`.
const payload = z.object({
  items: z.array(z.string().min(1)).min(2).max(6),
});
type Payload = z.infer<typeof payload>;

export const ${camel}: SceneDefinition<Payload> = {
  id: "${name}",
  templateId: "hf-${name}",
  name: "${title}",
  description: "One sentence: what this scene shows and when to use it.",
  // The scene's purpose for the motion director: hook, explanation, summary, ...
  role: "summary",
  // The backdrop: stack-cards is a calm panel; see the other scenes for more.
  recipe: "stack-cards",
  schema: payload,
  // How the scene uses the space in each format (shown in the scene library).
  layout: {
    "9:16": "One line per row down the panel",
    "16:9": "One line per row, wide text",
    "1:1": "One line per row, compact",
  },
  // Styles for the classes used in build(). Sizes are fractions of the frame
  // height: px(0.036) is 3.6% of it, so the scene fits every format.
  css: \`
    .fx-panelled .fx-dialogue:has(> .sc-${name}) { align-items: stretch; text-align: left; justify-content: center; }
    .sc-${name} { list-style: none; margin: 0; padding: 0; display: grid; gap: \${px(0.02)}; width: 100%; }
    .sc-${name}-row { display: flex; align-items: center; gap: \${px(0.022)}; font-weight: 700; line-height: 1.22; font-size: \${px(0.036)}; }
    .sc-${name}-dot { flex: none; width: \${px(0.018)}; height: \${px(0.018)}; border-radius: 50%; }
  \`,
  // The markup inside the panel. Escape every string with kit.escape(). Use
  // kit.ink for text and kit.accent for accents; kit.onAccent is the readable
  // colour on top of the accent.
  build({ items }, kit) {
    return \`
      \${kit.text ? \`<p class="fx-list-title" style="color:\${kit.ink}">\${kit.escape(kit.text)}</p>\` : ""}
      <ul class="sc-${name}">
        \${items
          .map(
            (item) => \`
        <li class="sc-${name}-row fx-rv" style="color:\${kit.ink}">
          <span class="sc-${name}-dot" style="background:\${kit.accent}"></span>
          <span>\${kit.escape(item)}</span>
        </li>\`,
          )
          .join("")}
      </ul>\`;
  },
  // Shown in the scene library and drawn by the tests and the preview.
  sample: {
    headline: "${title}",
    narration: "Replace this with one sentence a narrator would say here.",
    payload: {
      items: ["First line", "Second line", "Third line"],
    },
  },
};
`,
  );
  writeFileSync(
    path.join(folder, "index.test.ts"),
    `import { describe, expect, it } from "vitest";

import type { SceneKit } from "../types";
import { ${camel} } from "./index";

const kit: SceneKit = {
  text: "A headline",
  emphasis: [],
  ink: "#111111",
  accent: "#2255ee",
  onAccent: "#ffffff",
  chip: "",
  escape: (value) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
  emphasize: (text) => text,
  lineStack: (text) => text,
};

describe("${name} scene", () => {
  it("accepts its own sample and rejects too few or too many items", () => {
    expect(${camel}.schema.safeParse(${camel}.sample.payload).success).toBe(
      true,
    );
    expect(${camel}.schema.safeParse({ items: ["one"] }).success).toBe(false);
    expect(
      ${camel}.schema.safeParse({ items: Array(7).fill("x") }).success,
    ).toBe(false);
  });

  it("draws every item and escapes what a storyboard supplies", () => {
    const html = ${camel}.build({ items: ["<b>one</b>", "two & three"] }, kit);
    expect(html).toContain("&lt;b&gt;one&lt;/b&gt;");
    expect(html).toContain("two &amp; three");
    expect(html).not.toContain("<b>");
  });

  it("styles the classes it draws", () => {
    const html = ${camel}.build(${camel}.sample.payload, kit);
    expect(html).toContain("sc-${name}");
    expect(${camel}.css).toContain(".sc-${name}");
  });
});
`,
  );
  for (const [file, text] of contents) writeFileSync(path.resolve(file), text);

  const run = (cmd, args) =>
    execFileSync(cmd, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
  // The test runs in a copy of the repository that has no tools to run.
  if (process.argv.includes("--no-tools")) {
    console.log(`Created ${name} and registered it.`);
    process.exit(0);
  }
  run("npx", [
    "prettier",
    "--write",
    `src/engines/hyperframes/scenes/${name}`,
    ...new Set(contents.keys()),
  ]);
  run("npm", ["run", "storyboard:schema"]);
} catch (error) {
  // Leave the repository as it was.
  for (const [file, text] of originals) writeFileSync(path.resolve(file), text);
  rmSync(folder, { recursive: true, force: true });
  console.error(`\nScaffolding failed and was undone: ${error.message}`);
  process.exit(1);
}

console.log(`
Created src/engines/hyperframes/scenes/${name}/ and registered "${name}".
Next:
  1. edit build() and css in src/engines/hyperframes/scenes/${name}/index.ts
  2. npm run scene:preview ${name}     (three formats, frames in .artifacts/scenes)
  3. npx vitest run src/engines/hyperframes/scenes
See docs/CONTRIBUTING_SCENES.md.`);
