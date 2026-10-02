// @vitest-environment node
import {
  productionJobViewWithRevision,
  productionJobViewsWithRevisions,
} from "./production-job-view";
import { DatabaseSync } from "node:sqlite";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import type { PrismaClient } from "@prisma/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createPrismaClient } from "./prisma-client";
const state = vi.hoisted(() => ({
  db: null as PrismaClient | null,
  queries: [] as string[],
}));
vi.mock("@/library/db", () => ({
  get prisma() {
    return state.db!;
  },
}));
import {
  currentVideoRevisionHash,
  currentVideoRevisionHashes,
} from "./production-revision";
import {
  claimProductionJob,
  enqueueProductionJob,
  heartbeatProductionJob,
  listProductionJobs,
} from "./repositories/production-jobs";
let dir: string;
let filename: string;
let previous: string | undefined;
beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "reel-sqlite-polling-"));
  filename = path.join(dir, "test.db");
  const sqlite = new DatabaseSync(filename);
  for (const migration of readdirSync("prisma/migrations").sort())
    if (!migration.endsWith(".toml"))
      sqlite.exec(
        readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
      );
  sqlite.close();
  previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = `file:${filename}`;
  state.db = createPrismaClient({ onQuery: (sql) => state.queries.push(sql) });
  await state.db.brandKit.create({ data: { id: "kit", name: "Fixture" } });
  await state.db.project.create({
    data: { id: "project", name: "Fixture", brandKitId: "kit" },
  });
  for (let i = 0; i < 50; i++)
    await state.db.script.create({
      data: {
        id: `script-${i}`,
        name: "Fixture",
        projectId: "project",
        scenes: {
          create: { text: "Original text", order: 0, templateId: "hf-opener" },
        },
      },
    });
});
afterEach(async () => {
  await state.db!.$disconnect();
  if (previous === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previous;
  rmSync(dir, { recursive: true, force: true });
});
it("reduces revision reads for 50 distinct jobs while exposing edits on the very next read", async () => {
  const inputs = Array.from({ length: 50 }, (_, i) => ({
    scriptId: `script-${i}`,
  }));
  state.queries = [];
  const before = await Promise.all(
    inputs.map((input) => currentVideoRevisionHash(input.scriptId)),
  );
  for (let i = 0; i < inputs.length; i++) {
    const revision = await state.db!.productionRevision.create({
      data: {
        projectId: "project",
        scriptId: inputs[i].scriptId,
        revisionHash: before[i],
        snapshotJson: "{}",
      },
    });
    await state.db!.productionJob.create({
      data: {
        kind: "video",
        idempotencyKey: `revision-${i}`,
        productionRevisionId: revision.id,
        inputSnapshot: JSON.stringify({
          renderId: `render-${i}`,
          scriptId: inputs[i].scriptId,
        }),
      },
    });
  }
  const jobs = await listProductionJobs();
  state.queries = [];
  const oldViews = await Promise.all(jobs.map(productionJobViewWithRevision));
  const individual = state.queries.length;
  state.queries = [];
  const views = await productionJobViewsWithRevisions(jobs);
  const batchCount = state.queries.length;
  expect(views.map((view) => view.revision!.currentHash)).toEqual(
    oldViews.map((view) => view.revision!.currentHash),
  );
  expect(batchCount).toBeLessThan(20);
  expect(batchCount).toBeLessThan(individual / 10);
  await state.db!.scene.updateMany({
    where: { scriptId: "script-0" },
    data: { text: "Edited now" },
  });
  const fresh = await currentVideoRevisionHashes(inputs);
  expect(fresh.get('["script-0",null]')).not.toBe(before[0]);
  expect(fresh.get('["script-1",null]')).toBe(before[1]);
  await state.db!.captionTrack.create({
    data: {
      scriptId: "script-1",
      cues: {
        create: { order: 0, startFrame: 0, endFrame: 30, text: "New caption" },
      },
    },
  });
  const captions = await currentVideoRevisionHashes(inputs);
  expect(captions.get('["script-1",null]')).not.toBe(
    fresh.get('["script-1",null]'),
  );
  await state.db!.brandKit.update({
    where: { id: "kit" },
    data: { palette: JSON.stringify({ accent: "#ff0000" }) },
  });
  const branded = await currentVideoRevisionHashes(inputs);
  expect(branded.get('["script-2",null]')).not.toBe(
    captions.get('["script-2",null]'),
  );

  console.log(
    `[polling] 50 distinct scripts: ${individual} individual queries -> ${batchCount} batched queries; immediate edit detection passed`,
  );
});
it("uses verified WAL on two clients and waits through real worker/web lock contention", async () => {
  const workerClient = createPrismaClient();
  let blocker: ChildProcess | undefined;
  let closed: Promise<void> | undefined;
  try {
    expect(await state.db!.$queryRaw`PRAGMA journal_mode`).toEqual([
      { journal_mode: "wal" },
    ]);
    expect(await workerClient.$queryRaw`PRAGMA busy_timeout`).toEqual([
      { timeout: BigInt(5000) },
    ]);
    const submitted = await enqueueProductionJob(
      {
        kind: "audio",
        idempotencyKey: "contention-fixture",
        inputSnapshot: {},
      },
      workerClient,
    );
    await claimProductionJob({ workerId: "worker" }, workerClient);
    blocker = spawn(
      process.execPath,
      [
        "-e",
        `const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(process.argv[1]); db.exec('BEGIN IMMEDIATE'); process.send('locked'); setTimeout(() => { db.exec('COMMIT'); db.close(); process.disconnect(); }, 300);`,
        filename,
      ],
      { stdio: ["ignore", "ignore", "pipe", "ipc"] },
    );
    closed = new Promise((resolve) => blocker!.once("close", () => resolve()));
    await new Promise<void>((resolve, reject) => {
      blocker!.once("message", () => resolve());
      blocker!.once("error", reject);
    });
    const started = Date.now();
    // Read and renewal remain correct while another thread owns a write transaction.
    expect(await state.db!.productionJob.count()).toBe(1);
    expect(
      await heartbeatProductionJob(
        submitted.id,
        "worker",
        30_000,
        new Date(),
        workerClient,
      ),
    ).toBe(true);
    expect(Date.now() - started).toBeGreaterThan(100);
    expect(
      (
        await state.db!.productionJob.findUnique({
          where: { id: submitted.id },
        })
      )?.cancelRequested,
    ).toBe(false);
  } finally {
    if (blocker && blocker.exitCode === null) blocker.kill();
    await closed;
    await workerClient.$disconnect();
  }
});
it("recognizes the installed adapter's actual busy-timeout error", async () => {
  const { isSqliteContention } = await import("./sqlite-contention");
  const submitted = await enqueueProductionJob(
    { kind: "audio", idempotencyKey: "busy-error-fixture", inputSnapshot: {} },
    state.db!,
  );
  await claimProductionJob({ workerId: "worker" }, state.db!);
  const blocker = spawn(
    process.execPath,
    [
      "-e",
      `const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(process.argv[1]); db.exec('BEGIN IMMEDIATE'); process.send('locked'); setTimeout(() => { db.exec('COMMIT'); db.close(); process.disconnect(); }, 6000);`,
      filename,
    ],
    { stdio: ["ignore", "ignore", "pipe", "ipc"] },
  );
  const closed = new Promise<void>((resolve) =>
    blocker.once("close", () => resolve()),
  );
  try {
    await new Promise<void>((resolve, reject) => {
      blocker.once("message", () => resolve());
      blocker.once("error", reject);
    });
    let failure: unknown;
    try {
      await heartbeatProductionJob(
        submitted.id,
        "worker",
        30_000,
        new Date(),
        state.db!,
      );
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeDefined();
    expect(isSqliteContention(failure)).toBe(true);
  } finally {
    if (blocker.exitCode === null) blocker.kill();
    await closed;
  }
}, 15_000);
