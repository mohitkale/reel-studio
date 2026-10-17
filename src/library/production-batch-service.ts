import { hasMcpScope } from "@/production/mcp-access";
import { filmCanonicalJson } from "@/production/film-plan";
import type { RequestAuthorization } from "@/server/auth";
import { ProviderError } from "@/providers/voice/types";
import {
  expandProductionBatch,
  productionBatchRequestSchema,
  type ProductionBatchRequest,
} from "@/production/batch";
import { produceContentRequestSchema } from "@/production/api";
import {
  createProductionBatch,
  failProductionBatchItem,
  getProductionBatch,
  getProductionBatchByIdempotencyKey,
  linkProductionBatchItem,
} from "@/library/repositories/production-batches";
import {
  approveProductionJob,
  requestProductionJobCancellation,
  retryProductionJob,
} from "@/library/repositories/production-jobs";
import { submitProduction } from "@/library/production-service";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Production row is invalid";
}

export async function submitProductionBatch(args: {
  request: ProductionBatchRequest;
  auth: RequestAuthorization;
  serverBaseUrl: string;
}) {
  const request = productionBatchRequestSchema.parse(args.request);
  if (
    args.auth.origin === "mcp" &&
    args.auth.token.kind === "named" &&
    request.rows.length > args.auth.token.record.maxBatchSize
  ) {
    throw new ProviderError(
      `Batch has ${request.rows.length} rows; this token allows ${args.auth.token.record.maxBatchSize}`,
      403,
    );
  }
  const duplicate = await getProductionBatchByIdempotencyKey(
    request.idempotencyKey,
  );
  if (
    duplicate &&
    filmCanonicalJson(JSON.parse(duplicate.requestSnapshot)) !==
      filmCanonicalJson(request)
  )
    throw new ProviderError(
      "Idempotency key belongs to a different batch request",
      409,
    );

  const expanded = expandProductionBatch(request);
  let batch =
    duplicate ??
    (await createProductionBatch({
      idempotencyKey: request.idempotencyKey,
      requestSnapshot: request,
      priority: request.priority,
      items: expanded,
    }));

  for (const item of batch.items) {
    if (item.job || item.validationError) continue;
    const current = (await getProductionBatch(batch.id))?.items.find(
      (row) => row.id === item.id,
    );
    if (current?.validationError || current?.job) continue;
    const expandedItem = expanded.find(
      (candidate) =>
        candidate.rowIndex === item.rowIndex &&
        candidate.variantIndex === item.variantIndex,
    );
    if (!expandedItem) {
      await failProductionBatchItem(item.id, "Batch item snapshot is missing");
      continue;
    }
    try {
      const job = await submitProduction({
        request: produceContentRequestSchema.parse(expandedItem.request),
        auth: args.auth,
        serverBaseUrl: args.serverBaseUrl,
        batchItemId: item.id,
      });
      if (!job) throw new Error("Production job could not be created");
      const current = (await getProductionBatch(batch.id))?.items.find(
        (row) => row.id === item.id,
      );
      if (current?.validationError === "Canceled before submission")
        await requestProductionJobCancellation(job.id);
      await linkProductionBatchItem(item.id, job.id);
    } catch (error) {
      await failProductionBatchItem(item.id, errorMessage(error));
    }
  }
  batch = (await getProductionBatch(batch.id)) ?? batch;
  return batch;
}

export async function retryProductionBatch(args: {
  id: string;
  auth: RequestAuthorization;
  serverBaseUrl: string;
}) {
  const batch = await getProductionBatch(args.id);
  if (!batch) return null;
  for (const item of batch.items) {
    if (item.job && ["failed", "canceled"].includes(item.job.state)) {
      const saved = produceContentRequestSchema.parse(
        JSON.parse(item.requestSnapshot),
      );
      const approval =
        saved.runMode === "approval" ||
        (args.auth.origin === "mcp" &&
          (args.auth.token.kind !== "named" ||
            !hasMcpScope(args.auth.token.record, "production:automatic")));
      await retryProductionJob(
        item.job.id,
        undefined,
        approval ? "awaiting_approval" : "queued",
      );
      continue;
    }
    if (!item.job) {
      try {
        const request = produceContentRequestSchema.parse(
          JSON.parse(item.requestSnapshot),
        );
        const job = await submitProduction({
          request,
          auth: args.auth,
          serverBaseUrl: args.serverBaseUrl,
          batchItemId: item.id,
        });
        if (!job) throw new Error("Production job could not be created");
        await linkProductionBatchItem(item.id, job.id);
      } catch (error) {
        await failProductionBatchItem(item.id, errorMessage(error));
      }
    }
  }
  return getProductionBatch(args.id);
}

export async function cancelProductionBatch(id: string) {
  const batch = await getProductionBatch(id);
  if (!batch) return null;
  await Promise.all(
    batch.items.map((item) =>
      item.job
        ? requestProductionJobCancellation(item.job.id)
        : failProductionBatchItem(item.id, "Canceled before submission"),
    ),
  );
  return getProductionBatch(id);
}

export async function approveProductionBatch(id: string) {
  const batch = await getProductionBatch(id);
  if (!batch) return null;
  await Promise.all(
    batch.items.map((item) =>
      item.job?.state === "awaiting_approval"
        ? approveProductionJob(item.job.id)
        : null,
    ),
  );
  return getProductionBatch(id);
}
