import { Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "@/library/db";
import type { ExpandedProductionBatchItem } from "@/production/batch";

const productionBatchInclude = {
  items: {
    orderBy: [{ rowIndex: "asc" as const }, { variantIndex: "asc" as const }],
    include: {
      job: {
        include: {
          steps: { orderBy: { createdAt: "asc" as const } },
          outputs: { orderBy: { createdAt: "asc" as const } },
        },
      },
    },
  },
};

export async function createProductionBatch(
  input: {
    idempotencyKey: string;
    requestSnapshot: unknown;
    priority: number;
    items: ExpandedProductionBatchItem[];
  },
  db: PrismaClient = prisma,
) {
  try {
    return await db.productionBatch.create({
      data: {
        idempotencyKey: input.idempotencyKey,
        requestSnapshot: JSON.stringify(input.requestSnapshot),
        priority: input.priority,
        items: {
          create: input.items.map((item) => ({
            rowIndex: item.rowIndex,
            variantIndex: item.variantIndex,
            label: item.label,
            orientation: item.orientation,
            requestSnapshot: JSON.stringify(item.request),
          })),
        },
      },
      include: productionBatchInclude,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return db.productionBatch.findUniqueOrThrow({
        where: { idempotencyKey: input.idempotencyKey },
        include: productionBatchInclude,
      });
    }
    throw error;
  }
}

export async function getProductionBatch(
  id: string,
  db: PrismaClient = prisma,
) {
  return db.productionBatch.findUnique({
    where: { id },
    include: productionBatchInclude,
  });
}

export async function getProductionBatchByIdempotencyKey(
  idempotencyKey: string,
  db: PrismaClient = prisma,
) {
  return db.productionBatch.findUnique({
    where: { idempotencyKey },
    include: productionBatchInclude,
  });
}

export async function listProductionBatches(
  limit = 25,
  db: PrismaClient = prisma,
) {
  return db.productionBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(100, limit)),
    include: productionBatchInclude,
  });
}

export async function linkProductionBatchItem(
  itemId: string,
  jobId: string,
  db: PrismaClient = prisma,
) {
  return db.$transaction(async (tx) => {
    await tx.productionBatchItem.update({
      where: { id: itemId },
      data: { validationError: null },
    });
    return tx.productionJob.update({
      where: { id: jobId },
      data: { batchItemId: itemId },
    });
  });
}

export async function failProductionBatchItem(
  itemId: string,
  error: string,
  db: PrismaClient = prisma,
) {
  return db.productionBatchItem.update({
    where: { id: itemId },
    data: { validationError: error.slice(0, 2_000) },
  });
}
