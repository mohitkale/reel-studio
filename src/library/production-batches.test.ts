// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createPrismaClient } from "@/library/prisma-client";
import {
  createProductionBatch,
  failProductionBatchItem,
  getProductionBatch,
} from "@/library/repositories/production-batches";
import {
  enqueueProductionJob,
  retryProductionJob,
} from "@/library/repositories/production-jobs";
import {
  productionBatchState,
  productionBatchView,
} from "@/library/production-batch-view";
import {
  expandProductionBatch,
  productionBatchRequestSchema,
} from "@/production/batch";

describe("durable production batches", () => {
  let directory: string;
  let client: ReturnType<typeof createPrismaClient>;
  let previous: string | undefined;

  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), "reel-production-batch-"));
    const filename = path.join(directory, "batch.db");
    const sqlite = new DatabaseSync(filename);
    sqlite.exec("PRAGMA foreign_keys=ON");
    for (const migration of [
      "20260910000100_baseline",
      "20260911000100_production_jobs",
    ]) {
      sqlite.exec(
        readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
      );
    }
    sqlite.exec(
      "INSERT INTO ProductionJob (id,kind,state,inputSnapshot,idempotencyKey,updatedAt) VALUES ('legacy-job','audio','succeeded','{}','legacy-production',CURRENT_TIMESTAMP)",
    );
    sqlite.exec(
      "INSERT INTO ProductionJobStep (id,jobId,key,state,progress,updatedAt) VALUES ('legacy-step','legacy-job','validate','succeeded',1,CURRENT_TIMESTAMP)",
    );
    sqlite.exec(
      readFileSync(
        "prisma/migrations/20260913000100_production_batches/migration.sql",
        "utf8",
      ),
    );
    expect(sqlite.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
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

  it("migrates populated job records without losing their steps", async () => {
    const job = await client.productionJob.findUnique({
      where: { id: "legacy-job" },
      include: { steps: true },
    });
    expect(job).toMatchObject({ state: "succeeded", batchItemId: null });
    expect(job?.steps.map((step) => step.id)).toEqual(["legacy-step"]);
  });

  it("preserves successful variants when another item fails and retries only incomplete jobs", async () => {
    const request = productionBatchRequestSchema.parse({
      idempotencyKey: "durable-format-batch",
      rows: [{ kind: "video", scriptId: "script", label: "Launch" }],
    });
    const batch = await createProductionBatch(
      {
        idempotencyKey: request.idempotencyKey,
        requestSnapshot: request,
        priority: 0,
        items: expandProductionBatch(request),
      },
      client,
    );
    const [portrait, landscape, square] = batch.items;
    const succeeded = await enqueueProductionJob(
      {
        kind: "video",
        idempotencyKey: "durable-format-batch:portrait",
        inputSnapshot: { scriptId: "script", orientation: "portrait" },
        batchItemId: portrait!.id,
      },
      client,
    );
    const failed = await enqueueProductionJob(
      {
        kind: "video",
        idempotencyKey: "durable-format-batch:landscape",
        inputSnapshot: { scriptId: "script", orientation: "landscape" },
        batchItemId: landscape!.id,
      },
      client,
    );
    await client.productionJob.update({
      where: { id: succeeded.id },
      data: { state: "succeeded", finishedAt: new Date() },
    });
    await client.productionJob.update({
      where: { id: failed.id },
      data: {
        state: "failed",
        error: "encoder stopped",
        finishedAt: new Date(),
      },
    });
    await failProductionBatchItem(square!.id, "Missing asset", client);

    const partial = await getProductionBatch(batch.id, client);
    expect(partial).not.toBeNull();
    expect(productionBatchState(partial!)).toBe("partial_failure");
    expect(productionBatchView(partial!).succeededItems).toBe(1);

    await retryProductionJob(failed.id, client);
    const retried = await getProductionBatch(batch.id, client);
    expect(retried?.items[0]?.job?.state).toBe("succeeded");
    expect(retried?.items[1]?.job?.state).toBe("queued");
    expect(retried?.items[2]?.validationError).toBe("Missing asset");
  });
});
