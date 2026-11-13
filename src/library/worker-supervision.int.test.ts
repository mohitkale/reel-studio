// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  supervise,
  nextServerFlags,
  productionWorkerCommand,
} from "../../scripts/supervise.mjs";

function assertChildrenStopped(events: string) {
  const pids = [...events.matchAll(/(?:web|worker):(\d+):start/g)].map(
    (match) => Number(match[1]),
  );
  expect(pids.length).toBeGreaterThanOrEqual(2);
  for (const pid of pids) expect(() => process.kill(pid, 0)).toThrow();
}

describe("server listener", () => {
  it("defaults to loopback and preserves port flags", () => {
    expect(nextServerFlags(["--port", "3123"], { NODE_ENV: "test" })).toEqual([
      "--hostname",
      "127.0.0.1",
      "--port",
      "3123",
    ]);
  });
  it.each([["-H", "0.0.0.0"], ["--hostname", "::1"], ["--hostname=0.0.0.0"]])(
    "preserves explicit hostname %s",
    (...flags) => {
      expect(nextServerFlags(flags, { NODE_ENV: "test" })).toEqual(flags);
    },
  );
  it("supports an explicit container listener", () => {
    expect(
      nextServerFlags([], { NODE_ENV: "test", REEL_BIND_HOST: "0.0.0.0" }),
    ).toEqual(["--hostname", "0.0.0.0"]);
  });
});

describe("process supervision", () => {
  it("reloads imported TypeScript renderer changes in development", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "reel-worker-watch-"));
    const file = path.join(dir, "events");
    const renderer = path.join(dir, "renderer.ts");
    const entry = path.join(dir, "worker.ts");
    await writeFile(renderer, 'export const paint = "before";');
    await writeFile(
      entry,
      `import { appendFileSync } from 'node:fs';
       import { paint } from './renderer.ts';
       appendFileSync(${JSON.stringify(file)}, paint + '\\n');
       setInterval(() => {}, 1000);`,
    );
    const runner = supervise({
      web: [
        process.execPath,
        "scripts/fixtures/supervisor-child.mjs",
        "web",
        file,
      ],
      worker: [...productionWorkerCommand("dev").slice(0, -1), entry],
      graceMs: 1000,
    });
    try {
      await expect
        .poll(() => readFile(file, "utf8"), { timeout: 10000 })
        .toContain("before");
      await writeFile(renderer, 'export const paint = "after";');
      await expect
        .poll(() => readFile(file, "utf8"), { timeout: 10000 })
        .toContain("after");
      expect(productionWorkerCommand("start")).not.toContain("--watch");
    } finally {
      runner.stop();
      await runner.done;
      await rm(dir, { recursive: true, force: true });
    }
  }, 30000);
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
        const events = await readFile(file, "utf8");
        assertChildrenStopped(events);
        // Windows taskkill /T /F cannot deliver a POSIX SIGTERM callback.
        if (process.platform !== "win32")
          expect(events.match(/:stop/g)).toHaveLength(2);
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
      assertChildrenStopped(events);
      if (process.platform !== "win32") expect(events).toMatch(/web:.*:stop/);
    } finally {
      runner.stop();
      await runner.done;
      await rm(dir, { recursive: true, force: true });
    }
  });
});

it("resets the worker crash budget after stable uptime", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "reel-supervisor-stable-"));
  const file = path.join(dir, "events");
  const command = (role: string) => [
    process.execPath,
    "scripts/fixtures/supervisor-child.mjs",
    role,
    file,
  ];
  const runner = supervise({
    web: command("web"),
    worker: [...command("worker"), "recover-crash"],
    restartMs: 10,
    graceMs: 1000,
    maxRestarts: 1,
    stableMs: 1000,
  });
  try {
    expect(await runner.done).toBe(7);
    expect(
      (await readFile(file, "utf8")).match(/worker:.*:start/g),
    ).toHaveLength(3);
  } finally {
    runner.stop();
    await runner.done;
    await rm(dir, { recursive: true, force: true });
  }
});
