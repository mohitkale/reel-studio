import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "@/library/db";
import {
  enqueueProductionJobSchema,
  type ClaimedProductionJob,
  type EnqueueProductionJob,
  type ProductionJobState,
  type ProductionStepKey,
} from "@/production/jobs";

function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function parsed(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function enqueueProductionJob(
  input: EnqueueProductionJob,
  db: PrismaClient = prisma,
) {
  const data = enqueueProductionJobSchema.parse(input);
  try {
    return await db.productionJob.create({
      data: {
        kind: data.kind,
        idempotencyKey: data.idempotencyKey,
        inputSnapshot: json(data.inputSnapshot),
        priority: data.priority,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return db.productionJob.findUniqueOrThrow({
        where: { idempotencyKey: data.idempotencyKey },
      });
    }
    throw error;
  }
}

export async function claimProductionJob(
  args: { workerId: string; leaseMs?: number; now?: Date },
  db: PrismaClient = prisma,
): Promise<ClaimedProductionJob | null> {
  const now = args.now ?? new Date();
  const leaseExpiresAt = new Date(now.getTime() + (args.leaseMs ?? 30_000));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const candidate = await db.productionJob.findFirst({
      where: {
        cancelRequested: false,
        OR: [
          { state: "queued" },
          { state: "running", leaseExpiresAt: { lt: now } },
        ],
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
    if (!candidate) return null;
    const claimed = await db.productionJob.updateMany({
      where: {
        id: candidate.id,
        cancelRequested: false,
        OR: [
          { state: "queued" },
          { state: "running", leaseExpiresAt: { lt: now } },
        ],
      },
      data: {
        state: "running",
        leaseOwner: args.workerId,
        leaseExpiresAt,
        heartbeatAt: now,
        startedAt: candidate.startedAt ?? now,
        attempt: { increment: 1 },
        error: null,
      },
    });
    if (claimed.count !== 1) continue;
    const job = await db.productionJob.update({
      where: { id: candidate.id },
      data: {},
      include: { steps: true, outputs: true },
    });
    await appendProductionJobEvent(
      job.id,
      candidate.state === "running" ? "lease_recovered" : "started",
      { workerId: args.workerId, attempt: job.attempt },
      db,
    );
    return {
      id: job.id,
      kind: job.kind,
      state: "running",
      inputSnapshot: parsed(job.inputSnapshot),
      attempt: job.attempt,
      cancelRequested: job.cancelRequested,
      leaseOwner: args.workerId,
      leaseExpiresAt,
    };
  }
  return null;
}

export async function heartbeatProductionJob(
  jobId: string,
  workerId: string,
  leaseMs = 30_000,
  now = new Date(),
  db: PrismaClient = prisma,
): Promise<boolean> {
  const result = await db.productionJob.updateMany({
    where: {
      id: jobId,
      state: "running",
      leaseOwner: workerId,
      cancelRequested: false,
    },
    data: {
      heartbeatAt: now,
      leaseExpiresAt: new Date(now.getTime() + leaseMs),
    },
  });
  return result.count === 1;
}

export async function requestProductionJobCancellation(
  jobId: string,
  db: PrismaClient = prisma,
) {
  return db.$transaction(async (tx) => {
    const job = await tx.productionJob.findUnique({ where: { id: jobId } });
    if (!job || ["succeeded", "failed", "canceled"].includes(job.state))
      return job;
    const immediate =
      job.state === "queued" || job.state === "awaiting_approval";
    const updated = await tx.productionJob.update({
      where: { id: jobId },
      data: immediate
        ? {
            state: "canceled",
            cancelRequested: true,
            finishedAt: new Date(),
            leaseOwner: null,
            leaseExpiresAt: null,
          }
        : { cancelRequested: true },
    });
    await tx.productionJobEvent.create({
      data: { jobId, type: immediate ? "canceled" : "cancel_requested" },
    });
    return updated;
  });
}

export async function finishProductionJob(
  jobId: string,
  workerId: string,
  state: Extract<ProductionJobState, "succeeded" | "failed" | "canceled">,
  error?: string,
  db: PrismaClient = prisma,
): Promise<boolean> {
  const result = await db.productionJob.updateMany({
    where: { id: jobId, state: "running", leaseOwner: workerId },
    data: {
      state,
      error: error?.slice(0, 2_000) ?? null,
      finishedAt: new Date(),
      leaseOwner: null,
      leaseExpiresAt: null,
      heartbeatAt: null,
    },
  });
  if (result.count === 1)
    await appendProductionJobEvent(
      jobId,
      state,
      error ? { error: error.slice(0, 2_000) } : undefined,
      db,
    );
  return result.count === 1;
}

export async function upsertProductionJobStep(
  jobId: string,
  key: ProductionStepKey,
  input: {
    state: string;
    progress: number;
    cacheKey?: string;
    detail?: unknown;
    error?: string;
  },
) {
  const timestamps =
    input.state === "running"
      ? { startedAt: new Date() }
      : ["succeeded", "failed", "canceled"].includes(input.state)
        ? { finishedAt: new Date() }
        : {};
  return prisma.productionJobStep.upsert({
    where: { jobId_key: { jobId, key } },
    create: {
      jobId,
      key,
      state: input.state,
      progress: input.progress,
      cacheKey: input.cacheKey,
      detailJson: input.detail === undefined ? null : json(input.detail),
      error: input.error?.slice(0, 2_000),
      ...timestamps,
    },
    update: {
      state: input.state,
      progress: input.progress,
      cacheKey: input.cacheKey,
      detailJson: input.detail === undefined ? undefined : json(input.detail),
      error: input.error?.slice(0, 2_000),
      ...timestamps,
    },
  });
}

export async function appendProductionJobEvent(
  jobId: string,
  type: string,
  data?: unknown,
  db: PrismaClient = prisma,
) {
  return db.productionJobEvent.create({
    data: { jobId, type, dataJson: data === undefined ? null : json(data) },
  });
}

export async function listProductionJobEvents(jobId: string, afterId = 0) {
  return prisma.productionJobEvent.findMany({
    where: { jobId, id: { gt: afterId } },
    orderBy: { id: "asc" },
    take: 250,
  });
}
