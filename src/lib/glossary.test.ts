import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
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
  "src/app/page.tsx",
  "src/components/studio/onboarding.tsx",
  "src/components/studio/one-prompt-create.tsx",
  "src/components/studio/paste-storyboard.tsx",
  "src/app/batch/page.tsx",
  "src/app/brand-kits/page.tsx",
  "src/app/diagnostics/page.tsx",
  "src/app/examples/page.tsx",
  "src/app/library/page.tsx",
  "src/app/podcasts/page.tsx",
  "src/app/recordings/page.tsx",
  "src/app/scenes/page.tsx",
  "src/app/settings/page.tsx",
  "src/components/podcasts/podcast-audiogram-controls.tsx",
  "src/components/podcasts/podcast-workspace.tsx",
  "src/components/projects/create-with-ai-dialog.tsx",
  "src/components/projects/projects-library.tsx",
  "src/components/production/production-result.tsx",
  "src/components/production/quick-produce-status.tsx",
  "src/components/production/change-video.tsx",
  "src/components/production/result-actions.tsx",
  "src/components/shell/mode-switch.tsx",
  "src/components/studio/audio-import.tsx",
  "src/components/studio/audio-workbench.tsx",
  "src/components/studio/creation-hub.tsx",
  "src/components/studio/recording-transcript.tsx",
  "src/components/studio/speech-presets.tsx",
];

/** Text a person reads: quoted strings and JSX text, not imports, paths or identifiers. */
function visibleText(source: string, file: string): string[] {
  const out: string[] = [];
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (/^(import|export \{|\/\/|\/\*|\*)/.test(line)) continue;
    for (const m of line.matchAll(/(["`])((?:(?!\1).)*)\1/g)) {
      if (m[2].startsWith("/")) continue;
      const text = m[2].replace(/\$\{[^}]*\}/g, "").trim();
      if (/^[\w./@:#$[\]{}-]+$/.test(text) && !/^[A-Z][a-z]+$/.test(text))
        continue;
      if (/\bclassName\b|\bclass=/.test(line) && !/\s/.test(text)) continue;
      out.push(text);
    }
  }
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest);
  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) out.push(node.text.replace(/\s+/g, " ").trim());
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  return out;
}

describe("Simple screens use the plain words", () => {
  for (const file of SIMPLE_SCREENS) {
    it(file, () => {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      const hits = visibleText(source, file).filter((text) =>
        RETIRED.test(text),
      );
      expect(hits).toEqual([]);
    });
  }
});
