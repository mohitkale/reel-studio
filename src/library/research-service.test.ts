// @vitest-environment node
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createPrismaClient } from "./prisma-client";
import { ResearchRepository } from "./repositories/research";
import { normalizeResearchRequest, runResearchJob } from "./research-service";
import { evidenceFixture } from "@/research/fixtures";

vi.setConfig({ testTimeout: 15_000 });
const directory = mkdtempSync(path.join(tmpdir(), "reel-research-"));
const filename = path.join(directory, "research.db");
let client: ReturnType<typeof createPrismaClient>;
let repository: ResearchRepository;
const supplied = (key = "request-1", refresh = false) =>
  normalizeResearchRequest({
    idempotencyKey: key,
    query: "Product facts",
    mode: "supplied",
    refresh,
    sources: [
      { title: "Brief", text: "A local-first video editor for creators." },
    ],
  });

beforeAll(() => {
  const sql = new DatabaseSync(filename);
  for (const migration of readdirSync("prisma/migrations")
    .filter((name) => name !== "migration_lock.toml")
    .sort()) {
    if (migration.startsWith("20261029"))
      sql.exec(
        "INSERT INTO Project (id,name,updatedAt) VALUES ('saved','Existing work',CURRENT_TIMESTAMP)",
      );
    sql.exec(
      readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
    );
  }
  sql.close();
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = `file:${filename}`;
  client = createPrismaClient();
  if (previous === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previous;
  repository = new ResearchRepository(client);
});
beforeEach(async () => {
  await client.researchSubmission.deleteMany();
  await client.researchJob.deleteMany();
  await client.evidenceRevision.deleteMany();
});
afterAll(async () => {
  await client?.$disconnect();
  rmSync(directory, { recursive: true, force: true });
});

describe("durable research jobs", () => {
  it("migrates existing projects and stores validated immutable revisions", async () => {
    expect(
      await client.project.findUnique({ where: { id: "saved" } }),
    ).toMatchObject({ name: "Existing work" });
    const job = await repository.submit(supplied());
    const done = await runResearchJob(job.id, async () => evidenceFixture(), {
      repository,
    });
    expect(done?.state).toBe("succeeded");
    const first = await repository.getEvidence(done!.evidenceId!);
    expect(first?.revision).toBe(1);
    const refresh = await repository.submit(supplied("refresh-1", true));
    await runResearchJob(
      refresh.id,
      async () => ({ ...evidenceFixture(), summary: "Updated summary" }),
      { repository },
    );
    expect(await repository.getEvidence(first!.id)).toEqual(first);
    expect(await client.evidenceRevision.count()).toBe(2);
    expect(
      (
        await client.evidenceRevision.findFirst({
          orderBy: { revision: "desc" },
        })
      )?.revision,
    ).toBe(2);
  });
  it("deduplicates concurrent submissions and claims before any provider work", async () => {
    const jobs = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        repository.submit(supplied(`request-${i}`)),
      ),
    );
    expect(new Set(jobs.map((job) => job.id)).size).toBe(1);
    const adapter = vi.fn(async () => evidenceFixture());
    await Promise.all(
      jobs.map((job) => runResearchJob(job.id, adapter, { repository })),
    );
    expect(adapter).toHaveBeenCalledOnce();
    expect(await client.researchSubmission.count()).toBe(5);
  });
  it("reconnects without replay, caches until expiry and rejects key collisions", async () => {
    const job = await repository.submit(supplied());
    const adapter = vi.fn(async () => evidenceFixture());
    const done = await runResearchJob(job.id, adapter, { repository });
    expect((await repository.submit(supplied())).id).toBe(job.id);
    await runResearchJob(job.id, adapter, { repository });
    expect(adapter).toHaveBeenCalledOnce();
    const cached = await repository.submit(supplied("request-2"));
    expect(cached).toMatchObject({
      state: "succeeded",
      evidenceId: done?.evidenceId,
    });
    expect(JSON.parse(cached.usageJson).providerCalls).toBe(0);
    await expect(
      repository.submit({ ...supplied(), query: "Different facts" }),
    ).rejects.toMatchObject({ status: 409 });
    await client.evidenceRevision.updateMany({
      data: { expiresAt: new Date(0) },
    });
    expect((await repository.submit(supplied("request-3"))).state).toBe(
      "queued",
    );
  });
  it("never replays an uncertain charged operation after failure or restart", async () => {
    const request = normalizeResearchRequest({
      idempotencyKey: "paid-request",
      query: "Current facts",
      mode: "web",
      providerId: "gemini",
      budget: {
        maxProviderCalls: 1,
        maxSearchChargeUnits: 1,
        deadlineMs: 30_000,
        maxOutputTokens: 1024,
      },
    });
    const job = await repository.submit(request);
    const authorize = vi.fn(async () => {});
    const adapter = vi.fn(async ({ onProviderCall }) => {
      await onProviderCall();
      throw new Error("secret-provider-response");
    });
    const done = await runResearchJob(job.id, adapter, {
      repository,
      authorizeProvider: authorize,
    });
    expect(done).toMatchObject({ state: "failed" });
    expect(done?.error).not.toContain("secret-provider");
    expect(JSON.parse(done!.usageJson)).toMatchObject({
      providerCalls: 1,
      searchChargeUnits: 1,
      accounting: "reserved",
    });
    await runResearchJob(job.id, adapter, {
      repository,
      authorizeProvider: authorize,
    });
    expect(adapter).toHaveBeenCalledOnce();
    expect(authorize).toHaveBeenCalledOnce();
    const interrupted = await repository.submit({
      ...request,
      idempotencyKey: "interrupted",
      refresh: true,
    });
    await repository.claim(interrupted.id);
    await repository.expire(new Date(Date.now() + 60_000));
    await runResearchJob(interrupted.id, adapter, { repository });
    expect(adapter).toHaveBeenCalledOnce();
  });
  it("cancels running work across connections and never publishes late output", async () => {
    const job = await repository.submit(supplied());
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    let finish!: (value: ReturnType<typeof evidenceFixture>) => void;
    const work = runResearchJob(
      job.id,
      async () => {
        started();
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
      { repository },
    );
    await ready;
    await repository.finish(job.id, "canceled");
    expect((await work)?.state).toBe("canceled");
    finish(evidenceFixture());
    expect(await client.evidenceRevision.count()).toBe(0);
  });
  it("bounds even a stalled adapter by the deadline and retains empty/partial evidence", async () => {
    const job = await repository.submit(supplied());
    await client.researchJob.update({
      where: { id: job.id },
      data: { deadlineAt: new Date(Date.now() + 100) },
    });
    const result = await runResearchJob(
      job.id,
      async () => new Promise(() => {}),
      { repository },
    );
    expect(result?.state).toBe("failed");
    const next = await repository.submit(supplied("partial-1", true));
    await runResearchJob(
      next.id,
      async () => ({
        ...evidenceFixture(),
        sources: [],
        claims: [],
        summary: "",
        gaps: ["No usable sources returned"],
      }),
      { repository },
    );
    const saved = await repository.getJob(next.id);
    expect((await repository.getEvidence(saved!.evidenceId!))?.gaps).toEqual([
      "No usable sources returned",
    ]);
  });
});
