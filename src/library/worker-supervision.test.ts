// @vitest-environment node
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { supervise } from "../../scripts/supervise.mjs";

describe("process supervision", () => {
  it.each(["dev", "start", "docker"])(
    "stops both %s children on shutdown",
    async () => {
      const dir = await mkdtemp(path.join(tmpdir(), "reel-supervisor-"));
      const file = path.join(dir, "events");
      const command = (role: string) => [
        process.execPath,
        "scripts/fixtures/supervisor-child.mjs",
        role,
        file,
      ];
      const runner = supervise({
        web: command("web"),
        worker: command("worker"),
        graceMs: 1000,
      });
      try {
        await expect
          .poll(
            async () => (await readFile(file, "utf8")).split(":start").length,
          )
          .toBe(3);
        runner.stop();
        expect(await runner.done).toBe(0);
        expect((await readFile(file, "utf8")).match(/:stop/g)).toHaveLength(2);
      } finally {
        runner.stop();
        await runner.done;
        await rm(dir, { recursive: true, force: true });
      }
    },
  );
  it("bounds repeated worker crashes and stops the web process", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "reel-supervisor-"));
    const file = path.join(dir, "events");
    const command = (role: string) => [
      process.execPath,
      "scripts/fixtures/supervisor-child.mjs",
      role,
      file,
    ];
    const runner = supervise({
      web: command("web"),
      worker: [...command("worker"), "crash"],
      restartMs: 10,
      graceMs: 1000,
      maxRestarts: 2,
    });
    try {
      expect(await runner.done).toBe(7);
      const events = await readFile(file, "utf8");
      expect(events.match(/worker:.*:start/g)).toHaveLength(3);
      expect(events).toMatch(/web:.*:stop/);
    } finally {
      runner.stop();
      await runner.done;
      await rm(dir, { recursive: true, force: true });
    }
  });
});
