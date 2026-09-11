// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createPrismaClient } from "@/library/prisma-client";
import {
  claimProductionJob,
  enqueueProductionJob,
  heartbeatProductionJob,
  requestProductionJobCancellation,
} from "@/library/repositories/production-jobs";

describe("durable production jobs", () => {
  let directory: string;
  let client: ReturnType<typeof createPrismaClient>;
  let previous: string | undefined;

  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), "reel-production-jobs-"));
    const filename = path.join(directory, "jobs.db");
    const sqlite = new DatabaseSync(filename);
    sqlite.exec(
      readFileSync(
        "prisma/migrations/20260910000100_baseline/migration.sql",
        "utf8",
      ),
    );
    sqlite.exec(
      readFileSync(
        "prisma/migrations/20260911000100_production_jobs/migration.sql",
        "utf8",
      ),
    );
    sqlite.close();
    previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = `file:${filename}`;
    client = createPrismaClient();
  });

  afterEach(async () => {
    await client.$disconnect();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    rmSync(directory, { recursive: true, force: true });
  });

  it("deduplicates submissions and prevents simultaneous claims", async () => {
    const input = {
      kind: "video" as const,
      idempotencyKey: "same-request",
      inputSnapshot: { spec: 1 },
    };
    const first = await enqueueProductionJob(input, client);
    const duplicate = await enqueueProductionJob(input, client);
    expect(duplicate.id).toBe(first.id);
    const claimed = await claimProductionJob(
      { workerId: "worker-a", now: new Date("2026-09-11T10:00:00Z") },
      client,
    );
    expect(claimed?.inputSnapshot).toEqual({ spec: 1 });
    expect(
      await claimProductionJob(
        { workerId: "worker-b", now: new Date("2026-09-11T10:00:01Z") },
        client,
      ),
    ).toBeNull();
  });

  it("recovers expired leases and stops heartbeats after cancellation", async () => {
    const job = await enqueueProductionJob(
      { kind: "video", idempotencyKey: "recover-request", inputSnapshot: {} },
      client,
    );
    await claimProductionJob(
      {
        workerId: "old-worker",
        leaseMs: 1_000,
        now: new Date("2026-09-11T10:00:00Z"),
      },
      client,
    );
    const recovered = await claimProductionJob(
      {
        workerId: "new-worker",
        leaseMs: 30_000,
        now: new Date("2026-09-11T10:00:02Z"),
      },
      client,
    );
    expect(recovered?.id).toBe(job.id);
    expect(recovered?.attempt).toBe(2);
    await requestProductionJobCancellation(job.id, client);
    expect(
      await heartbeatProductionJob(
        job.id,
        "new-worker",
        30_000,
        new Date(),
        client,
      ),
    ).toBe(false);
  });

  it("cancels queued jobs immediately", async () => {
    const job = await enqueueProductionJob(
      { kind: "audio", idempotencyKey: "cancel-request", inputSnapshot: {} },
      client,
    );
    const canceled = await requestProductionJobCancellation(job.id, client);
    expect(canceled?.state).toBe("canceled");
    expect(await claimProductionJob({ workerId: "worker" }, client)).toBeNull();
  });
});
