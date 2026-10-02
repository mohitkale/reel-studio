// @vitest-environment node
import {
  mkdtemp,
  mkdir,
  open,
  rm,
  symlink,
  writeFile,
  rename,
} from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalDiskStore } from "./local-disk";

const directories: string[] = [];
async function fixture() {
  const dir = await mkdtemp(path.join(tmpdir(), "reel-store-"));
  directories.push(dir);
  const root = path.join(dir, "media");
  await mkdir(root);
  return { dir, root, store: new LocalDiskStore(root) };
}
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("bounded disk reads", () => {
  it("keeps size and body on the same opened file when its path is replaced", async () => {
    const { root, store } = await fixture();
    await writeFile(path.join(root, "clip.mp4"), "original");
    const asset = await store.open("clip.mp4");
    await writeFile(path.join(root, "replacement.mp4"), "new");
    // NTFS refuses replacement of an open destination; the opened-file read
    // remains valid and replacement can proceed once that handle is closed.
    if (process.platform === "win32") {
      await expect(
        rename(path.join(root, "replacement.mp4"), path.join(root, "clip.mp4")),
      ).rejects.toMatchObject({ code: "EPERM" });
    } else {
      await rename(
        path.join(root, "replacement.mp4"),
        path.join(root, "clip.mp4"),
      );
    }
    expect(asset.size).toBe(8);
    expect(await new Response(asset.stream()).text()).toBe("original");
    if (process.platform === "win32")
      await rename(
        path.join(root, "replacement.mp4"),
        path.join(root, "clip.mp4"),
      );
    expect((await store.get("clip.mp4")).toString()).toBe("new");
  });

  it("reads a tiny tail of an 8 GiB asset without allocating the asset", async () => {
    const { root, store } = await fixture();
    const file = await open(path.join(root, "large.mp4"), "w");
    // NTFS needs an explicit sparse flag before extending this fixture.
    if (process.platform === "win32")
      await promisify(execFile)("fsutil.exe", [
        "sparse",
        "setflag",
        path.join(root, "large.mp4"),
      ]);
    const size = 8 * 1024 ** 3;
    await file.truncate(size);
    await file.write(Buffer.from("tail"), 0, 4, size - 4);
    await file.close();
    const before = process.memoryUsage().arrayBuffers;
    const asset = await store.open("large.mp4");
    expect(asset.size).toBe(size);
    expect(await new Response(asset.stream({ start: size - 4 })).text()).toBe(
      "tail",
    );
    expect(process.memoryUsage().arrayBuffers - before).toBeLessThan(
      4 * 1024 ** 2,
    );
    await asset.close();
  });
  it("applies backpressure and releases handles on body cancellation and abort", async () => {
    const { root, store } = await fixture();
    await writeFile(path.join(root, "clip.mp4"), Buffer.alloc(256 * 1024, 1));
    const asset = await store.open("clip.mp4");
    const reader = asset.stream().getReader();
    expect((await reader.read()).value?.byteLength).toBe(64 * 1024);
    await reader.cancel();
    await asset.close();
    expect(() => asset.stream()).toThrow();
    const aborted = await store.open("clip.mp4");
    const controller = new AbortController();
    const body = aborted.stream({ signal: controller.signal });
    controller.abort();
    await expect(new Response(body).arrayBuffer()).rejects.toThrow();
    await aborted.close();
    // On Windows this also proves the handles no longer prevent deletion.
    await rm(path.join(root, "clip.mp4"));
  });
  it("rejects traversal, external file/directory symlinks and non-files", async () => {
    const { dir, root, store } = await fixture();
    await writeFile(path.join(dir, "secret.txt"), "secret");
    await mkdir(path.join(dir, "outside"));
    await writeFile(path.join(dir, "outside", "secret.txt"), "secret");
    await symlink(path.join(dir, "secret.txt"), path.join(root, "link.txt"));
    await symlink(
      path.join(dir, "outside"),
      path.join(root, "linked"),
      process.platform === "win32" ? "junction" : "dir",
    );
    for (const key of [
      "../secret.txt",
      "link.txt",
      "linked/secret.txt",
      "",
      "missing",
    ])
      await expect(store.open(key)).rejects.toThrow();
    await expect(store.get("link.txt")).rejects.toThrow();
  });
  it("serves empty files and detects truncation rather than silent success", async () => {
    const { root, store } = await fixture();
    const name = path.join(root, "clip.mp4");
    await writeFile(name, "");
    expect((await store.get("clip.mp4")).length).toBe(0);
    await writeFile(name, "original");
    const asset = await store.open("clip.mp4");
    await writeFile(name, "");
    await expect(new Response(asset.stream()).text()).rejects.toThrow(
      "truncated",
    );
    await asset.close();
  });
});
