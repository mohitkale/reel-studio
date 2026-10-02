// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import type { PrismaClient } from "@prisma/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createPrismaClient } from "./prisma-client";
import { LocalDiskStore } from "./storage/local-disk";
const state = vi.hoisted(() => ({
  db: null as PrismaClient | null,
  directory: "",
}));
vi.mock("@/library/db", () => ({
  get prisma() {
    return state.db!;
  },
}));
vi.mock("@/library/storage", () => ({
  getAssetStore: () => new LocalDiskStore(path.join(state.directory, "media")),
}));
import {
  submitEditorVoice,
  getEditorVoiceJob,
  executeEditorVoiceJob,
} from "./editor-jobs";
import {
  submitEditorRender,
  approveEditorRender,
  reconcileRenderJobs,
} from "./editor-render-jobs";
import { runProductionWorkerOnce } from "./production-worker";
import {
  claimProductionJob,
  requestProductionJobCancellation,
} from "./repositories/production-jobs";
let previous: string | undefined;
beforeEach(async () => {
  state.directory = mkdtempSync(path.join(tmpdir(), "reel-editor-jobs-"));
  const filename = path.join(state.directory, "jobs.db");
  const sqlite = new DatabaseSync(filename);
  for (const dir of readdirSync("prisma/migrations").sort()) {
    if (dir !== "migration_lock.toml")
      sqlite.exec(
        readFileSync(`prisma/migrations/${dir}/migration.sql`, "utf8"),
      );
  }
  sqlite.close();
  previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = `file:${filename}`;
  state.db = createPrismaClient();
  await state.db.project.create({ data: { id: "project", name: "Fixture" } });
  await state.db.script.create({
    data: { id: "script", name: "Fixture", projectId: "project" },
  });
  await state.db.scene.create({
    data: {
      id: "scene",
      scriptId: "script",
      order: 0,
      text: "Hello from the durable worker",
      templateId: "hf-typewriter",
    },
  });
});
afterEach(async () => {
  await state.db!.$disconnect();
  if (previous === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previous;
  rmSync(state.directory, { recursive: true, force: true });
});
it("runs credential-free narration through the worker and rehydrates completion after reconnect", async () => {
  const id = await submitEditorVoice({
    operation: "take",
    resourceId: "script",
    placeholder: true,
  });
  expect((await getEditorVoiceJob(id, "script"))?.status).toBe("queued");
  expect(await getEditorVoiceJob(id, "other")).toBeUndefined();
  expect(
    await runProductionWorkerOnce({
      workerId: "fixture",
      execute: executeEditorVoiceJob,
    }),
  ).toBe("succeeded");
  await state.db!.$disconnect();
  state.db = createPrismaClient();
  const recovered = await getEditorVoiceJob(id, "script");
  expect(recovered?.status).toBe("done");
  expect(recovered?.take?.timeline).toHaveLength(1);
});
it("fails interrupted provider jobs without automatic replay", async () => {
  const id = await submitEditorVoice({
    operation: "take",
    resourceId: "script",
    providerId: "elevenlabs",
    voiceId: "fixture",
  });
  await claimProductionJob(
    { workerId: "dead", leaseMs: 1, now: new Date(0) },
    state.db!,
  );
  expect(
    await claimProductionJob({ workerId: "replacement" }, state.db!),
  ).toBeNull();
  expect((await getEditorVoiceJob(id, "script"))?.error).toContain(
    "explicit retry",
  );
});
it("retains approved render orientation and quality, then reflects cancellation on cards", async () => {
  const render = await submitEditorRender({
    scriptId: "script",
    orientation: "landscape",
    quality: "draft",
    approval: true,
  });
  expect(render.status).toBe("pending_approval");
  expect(await claimProductionJob({ workerId: "early" }, state.db!)).toBeNull();
  await approveEditorRender(render.id, "http://localhost:3000");
  const job = await claimProductionJob(
    { workerId: "after-approval" },
    state.db!,
  );
  expect(job?.inputSnapshot).toMatchObject({
    orientation: "landscape",
    quality: "draft",
  });
  await requestProductionJobCancellation(job!.id, state.db!);
  await claimProductionJob(
    { workerId: "recovery", now: new Date(Date.now() + 60_000) },
    state.db!,
  );
  await reconcileRenderJobs();
  expect(
    (await state.db!.render.findUnique({ where: { id: render.id } }))?.status,
  ).toBe("error");
});
it("repairs legacy interrupted renders without replaying them", async () => {
  await state.db!.render.create({
    data: {
      id: "orphan",
      scriptId: "script",
      status: "rendering",
      createdAt: new Date(0),
    },
  });
  await reconcileRenderJobs();
  expect(
    (await state.db!.render.findUnique({ where: { id: "orphan" } }))?.error,
  ).toContain("explicit retry");
});

it("honors cancellation arriving before the worker publishes terminal success", async () => {
  const id = await submitEditorVoice({
    operation: "take",
    resourceId: "script",
    placeholder: true,
  });
  expect(
    await runProductionWorkerOnce({
      workerId: "cancel-fixture",
      execute: async (job) => {
        await requestProductionJobCancellation(job.id, state.db!);
      },
    }),
  ).toBe("canceled");
  expect((await getEditorVoiceJob(id, "script"))?.status).toBe("error");
});
