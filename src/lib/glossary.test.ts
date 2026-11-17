import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Words the studio no longer shows people on the Simple screens (roadmap U5). Pro
 * workspaces keep their technical names by decision (U9), so only the screens
 * Simple mode uses are checked here.
 */
const RETIRED =
  /\b(quick produce|film plan|factory run|recipes?|takes?|renders?|rendering|rendered|productions?|projects?)\b/i;

const SIMPLE_SCREENS = [
  "src/lib/nav.ts",
  "src/components/studio/onboarding.tsx",
  "src/components/studio/one-prompt-create.tsx",
  "src/components/studio/paste-storyboard.tsx",
  "src/app/examples/page.tsx",
  "src/app/library/page.tsx",
  "src/components/projects/projects-library.tsx",
  "src/components/production/production-result.tsx",
  "src/components/production/quick-produce-status.tsx",
  "src/components/production/change-video.tsx",
  "src/components/production/result-actions.tsx",
  "src/components/shell/mode-switch.tsx",
];

/** Text a person reads: quoted strings and JSX text, not imports, paths or identifiers. */
function visibleText(source: string): string[] {
  const out: string[] = [];
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (/^(import|export \{|\/\/|\/\*|\*)/.test(line)) continue;
    for (const m of line.matchAll(/(["`])((?:(?!\1).)*)\1/g)) {
      const text = m[2];
      if (/^[\w./@:#$[\]{}-]+$/.test(text) && !text.includes(" ")) continue;
      if (/\bclassName\b|\bclass=/.test(line) && !/\s/.test(text)) continue;
      out.push(text);
    }
    const jsx = line.match(/^[A-Za-z][^<>{}=;":]*[a-z.,!?]$/);
    if (jsx) out.push(jsx[0]);
  }
  return out;
}

describe("Simple screens use the plain words", () => {
  for (const file of SIMPLE_SCREENS) {
    it(file, () => {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      const hits = visibleText(source).filter((text) => RETIRED.test(text));
      expect(hits).toEqual([]);
    });
  }
});
