// @vitest-environment node
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
} from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localFsPathForUrl, materializeUrl } from "./hyperframes-render";
let dir: string, project: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "reel-render-boundary-"));
  project = path.join(dir, "project");
  await mkdir(path.join(dir, "media"));
  await mkdir(path.join(dir, "public", "music"), { recursive: true });
  await mkdir(project);
  vi.spyOn(process, "cwd").mockReturnValue(dir);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});
describe("render local file boundary", () => {
  it("copies app-relative and exact-origin media into the render project", async () => {
    await writeFile(path.join(dir, "media", "test.wav"), "fixture");
    expect(
      localFsPathForUrl(
        "http://localhost:3000/media/test.wav",
        "http://localhost:3000",
      ),
    ).toBe(path.join(dir, "media", "test.wav"));
    expect(
      await materializeUrl(
        "/media/test.wav",
        project,
        "voice",
        "http://localhost:3000",
      ),
    ).toBe("_assets/voice.wav");
    expect(
      await readFile(path.join(project, "_assets", "voice.wav"), "utf8"),
    ).toBe("fixture");
  });
  it("does not treat other origins, credentials or non-web schemes as local", () => {
    for (const value of [
      "http://localhost:4000/media/x",
      "https://localhost:3000/media/x",
      "http://u:p@localhost:3000/media/x",
      "http://127.0.0.1:3000/media/x",
      "file:///media/x",
    ])
      expect(localFsPathForUrl(value, "http://localhost:3000")).toBeNull();
  });
  it("rejects external symlinks even when their lexical path is inside media", async () => {
    const outside = path.join(dir, "outside.wav");
    await writeFile(outside, "secret");
    await symlink(outside, path.join(dir, "media", "linked.wav"), "file");
    await expect(
      materializeUrl(
        "/media/linked.wav",
        project,
        "voice",
        "http://localhost:3000",
      ),
    ).rejects.toThrow(/escapes/i);
  });
  it.each([
    "/media/%2e%2e/%2e%2e/secret",
    "data:text/html,private",
    "blob:http://localhost/x",
    "http://localhost:3000/api/settings",
    "https://[::ffff:7f00:1]/secret",
  ])("rejects unsupported/escaping media: %s", async (value) => {
    await expect(
      materializeUrl(value, project, "asset", "http://localhost:3000"),
    ).rejects.toThrow();
  });
});
