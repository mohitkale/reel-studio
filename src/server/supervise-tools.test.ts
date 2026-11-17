// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";

// @ts-expect-error The launcher is plain JavaScript.
import { withInstalledTools } from "../../scripts/supervise.mjs";

const homes: string[] = [];
const home = () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "reel-supervise-"));
  homes.push(dir);
  return dir;
};
afterEach(() =>
  homes.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })),
);

it("leaves PATH alone when no tool was installed into the data directory", () => {
  expect(withInstalledTools("/usr/bin", home())).toBe("/usr/bin");
});

it("puts an installed FFmpeg in front of PATH", () => {
  const dir = home();
  const bin = path.join(dir, "tools", "ffmpeg", "ffmpeg-9", "bin");
  mkdirSync(bin, { recursive: true });
  const exe = process.platform === "win32" ? ".exe" : "";
  writeFileSync(path.join(bin, `ffmpeg${exe}`), "");
  expect(withInstalledTools("/usr/bin", dir)).toBe(
    [bin, "/usr/bin"].join(path.delimiter),
  );
});
