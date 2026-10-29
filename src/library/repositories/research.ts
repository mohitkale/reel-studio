import { randomUUID, createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/library/db";
import {
  evidencePackSchema,
  EMPTY_RESEARCH_USAGE,
  type EvidencePack,
  type ResearchRequest,
  type ResearchUsage,
} from "@/research/contracts";

export class ResearchError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export function researchKeys(request: ResearchRequest) {
  const { idempotencyKey: _key, refresh, budget, ...content } = request;
  void _key;
  const hash = (value: unknown) =>
    createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const cacheKey = hash({
    version: 1,
    ...content,
    maxOutputTokens: budget.maxOutputTokens,
  });
  return { cacheKey, fingerprint: hash({ cacheKey, refresh, budget }) };
}

export class ResearchRepository {
  constructor(readonly db: PrismaClient = prisma) {}

  getJob(id: string) {
    return this.db.researchJob.findUnique({ where: { id } });
  }

  async reconnect(request: ResearchRequest) {
    const prior = await this.db.researchSubmission.findUnique({
      where: { idempotencyKey: request.idempotencyKey },
      include: { job: true },
    });
    if (prior && prior.fingerprint !== researchKeys(request).fingerprint)
      throw new ResearchError(
        "Idempotency key already belongs to a different research request",
        409,
      );
    return prior?.job ?? null;
  }

  cached(request: ResearchRequest, now = new Date()) {
    return this.db.evidenceRevision.findFirst({
      where: {
        cacheKey: researchKeys(request).cacheKey,
        expiresAt: { gt: now },
      },
      orderBy: { revision: "desc" },
    });
  }

  async getEvidence(id: string): Promise<EvidencePack | null> {
    const row = await this.db.evidenceRevision.findUnique({ where: { id } });
    return row ? evidencePackSchema.parse(JSON.parse(row.packJson)) : null;
  }

  /** Expired in-flight work is terminal: never automatically replay paid IO. */
  async expire(now = new Date()) {
    await this.db.researchJob.updateMany({
      where: { state: { in: ["queued", "running"] }, deadlineAt: { lte: now } },
      data: {
        state: "failed",
        activeKey: null,
        error:
          "Research deadline expired; inspect usage before an explicit refresh.",
        finishedAt: now,
      },
    });
  }

  async submit(request: ResearchRequest, now = new Date()) {
    const { cacheKey, fingerprint } = researchKeys(request);
    await this.expire(now);
    // Only pre-IO database contention is retried. Never wrap external calls here.
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.db.$transaction(async (tx) => {
          const prior = await tx.researchSubmission.findUnique({
            where: { idempotencyKey: request.idempotencyKey },
            include: { job: true },
          });
          if (prior) {
            if (prior.fingerprint !== fingerprint)
              throw new ResearchError(
                "Idempotency key already belongs to a different research request",
                409,
              );
            return prior.job;
          }
          let job = await tx.researchJob.findUnique({
            where: { activeKey: fingerprint },
          });
          if (!job) {
            const cached = request.refresh
              ? null
              : await tx.evidenceRevision.findFirst({
                  where: { cacheKey, expiresAt: { gt: now } },
                  orderBy: { revision: "desc" },
                });
            job = await tx.researchJob.create({
              data: {
                cacheKey,
                activeKey: cached ? null : fingerprint,
                requestJson: JSON.stringify(request),
                state: cached ? "succeeded" : "queued",
                usageJson: JSON.stringify(EMPTY_RESEARCH_USAGE),
                deadlineAt: new Date(now.getTime() + request.budget.deadlineMs),
                evidenceId: cached?.id,
                finishedAt: cached ? now : null,
              },
            });
          }
          await tx.researchSubmission.create({
            data: {
              idempotencyKey: request.idempotencyKey,
              fingerprint,
              jobId: job.id,
            },
          });
          return job;
        });
      } catch (error) {
        if (
          attempt < 3 &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          ["P2002", "P2034", "P1008"].includes(error.code)
        )
          continue;
        throw error;
      }
    }
  }

  async claim(id: string, now = new Date()) {
    await this.expire(now);
    const result = await this.db.researchJob.updateMany({
      where: { id, state: "queued", deadlineAt: { gt: now } },
      data: { state: "running" },
    });
    return result.count === 1 ? this.getJob(id) : null;
  }

  async recordUsage(id: string, usage: ResearchUsage) {
    const result = await this.db.researchJob.updateMany({
      where: { id, state: "running" },
      data: { usageJson: JSON.stringify(usage) },
    });
    return result.count === 1;
  }

  async finish(
    id: string,
    state: "failed" | "canceled",
    error: string | null = null,
  ) {
    await this.db.researchJob.updateMany({
      where: { id, state: { in: ["running", "queued"] } },
      data: { state, error, activeKey: null, finishedAt: new Date() },
    });
    return this.getJob(id);
  }

  async publish(id: string, input: EvidencePack, now = new Date()) {
    return this.db.$transaction(async (tx) => {
      const job = await tx.researchJob.findUniqueOrThrow({ where: { id } });
      if (job.state !== "running" || job.deadlineAt <= now) return null;
      const latest = await tx.evidenceRevision.findFirst({
        where: { cacheKey: job.cacheKey },
        orderBy: { revision: "desc" },
      });
      const pack = evidencePackSchema.parse({
        ...input,
        id: randomUUID(),
        revision: (latest?.revision ?? 0) + 1,
        createdAt: now.toISOString(),
      });
      const packJson = JSON.stringify(pack);
      if (Buffer.byteLength(packJson) > 900_000)
        throw new ResearchError(
          "Evidence exceeds its inspection size limit",
          502,
        );
      await tx.evidenceRevision.create({
        data: {
          id: pack.id,
          cacheKey: job.cacheKey,
          revision: pack.revision,
          packJson,
          expiresAt: new Date(now.getTime() + 6 * 60 * 60 * 1000),
        },
      });
      return tx.researchJob.update({
        where: { id },
        data: {
          state: "succeeded",
          activeKey: null,
          evidenceId: pack.id,
          usageJson: JSON.stringify(pack.usage),
          finishedAt: now,
        },
      });
    });
  }
}
