import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// `npm run scene:new` edits files that must stay in step with the code. This
// runs it in a copy of those files, so a change that moves one of them fails here
// instead of in the next contributor's terminal.
const FILES = [
  "src/engines/hyperframes/scenes/registry.ts",
  "src/engines/hyperframes/scenes/registry.test.ts",
  "src/storyboard/schema.ts",
  "src/production/storyboard-plan.ts",
  "src/library/project-storyboard.ts",
  "scripts/scene-sheet.mjs",
];
const SCRIPT = path.resolve("scripts/scene-new.mjs");
const dirs: string[] = [];

function copyOfRepo(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "scene-new-"));
  dirs.push(dir);
  for (const file of FILES) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    cpSync(path.resolve(file), path.join(dir, file));
  }
  return dir;
}
const run = (cwd: string, ...args: string[]) =>
  spawnSync(process.execPath, [SCRIPT, ...args, "--no-tools"], {
    cwd,
    encoding: "utf8",
  });

afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

describe("npm run scene:new", () => {
  it("creates the folder and registers the type in every place", () => {
    const dir = copyOfRepo();
    const result = run(dir, "scaffold-sample");
    expect(result.status, result.stderr).toBe(0);
    const folder = path.join(
      dir,
      "src/engines/hyperframes/scenes/scaffold-sample",
    );
    expect(existsSync(path.join(folder, "index.ts"))).toBe(true);
    expect(existsSync(path.join(folder, "index.test.ts"))).toBe(true);
    for (const file of FILES) {
      const text = readFileSync(path.join(dir, file), "utf8");
      expect(text, file).toMatch(/scaffold-sample|scaffoldSample/);
    }
    const index = readFileSync(path.join(folder, "index.ts"), "utf8");
    expect(index).toContain('id: "scaffold-sample"');
    expect(index).toContain('templateId: "hf-scaffold-sample"');
    expect(index).toContain("export const scaffoldSample");
    // The generated source is valid TypeScript (esbuild would refuse it otherwise).
    execFileSync(
      process.execPath,
      [
        "-e",
        `require("esbuild").transformSync(require("fs").readFileSync(${JSON.stringify(path.join(folder, "index.ts"))}, "utf8"), { loader: "ts" })`,
      ],
      { cwd: path.resolve("."), stdio: "pipe" },
    );
  });

  it("keeps both registrations when scaffolding a second scene", () => {
    const dir = copyOfRepo();
    const first = run(dir, "scaffold-sample");
    const second = run(dir, "scaffold-followup");
    expect(first.status, first.stderr).toBe(0);
    expect(second.status, second.stderr).toBe(0);
    for (const file of FILES) {
      const text = readFileSync(path.join(dir, file), "utf8");
      expect(text, file).toMatch(/scaffold-sample|scaffoldSample/);
      expect(text, file).toMatch(/scaffold-followup|scaffoldFollowup/);
    }
  });

  it("refuses a bad or existing name and changes nothing", () => {
    const dir = copyOfRepo();
    expect(run(dir, "Pro Tip").status).toBe(1);
    expect(run(dir, "scaffold-sample").status).toBe(0);
    expect(run(dir, "scaffold-sample").status).toBe(1);
  });

  it("changes nothing when a registration point has moved", () => {
    const dir = copyOfRepo();
    const file = path.join(dir, "src/production/storyboard-plan.ts");
    const before = readFileSync(file, "utf8").replace(
      '    recap: "hf-recap",\n',
      "",
    );
    writeFileSync(file, before);
    const registry = readFileSync(
      path.join(dir, "src/engines/hyperframes/scenes/registry.ts"),
      "utf8",
    );
    const result = run(dir, "scaffold-sample");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("storyboard-plan.ts");
    expect(readFileSync(file, "utf8")).toBe(before);
    expect(
      readFileSync(
        path.join(dir, "src/engines/hyperframes/scenes/registry.ts"),
        "utf8",
      ),
    ).toBe(registry);
    expect(
      existsSync(
        path.join(dir, "src/engines/hyperframes/scenes/scaffold-sample"),
      ),
    ).toBe(false);
  });
});
