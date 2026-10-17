import { prisma } from "@/library/db";
import { productionBatchView } from "@/library/production-batch-view";
/** Factory polling needs progress and download links, never multi-MiB stage snapshots. */
export async function factoryBatchView(id: string) {
  const batch = await prisma.productionBatch.findUnique({
    where: { id },
    select: {
      id: true,
      idempotencyKey: true,
      priority: true,
      createdAt: true,
      updatedAt: true,
      items: {
        orderBy: [{ rowIndex: "asc" }, { variantIndex: "asc" }],
        select: {
          id: true,
          rowIndex: true,
          variantIndex: true,
          label: true,
          orientation: true,
          validationError: true,
          job: {
            select: {
              id: true,
              kind: true,
              state: true,
              priority: true,
              attempt: true,
              cancelRequested: true,
              error: true,
              createdAt: true,
              updatedAt: true,
              startedAt: true,
              finishedAt: true,
              steps: {
                select: { key: true, state: true, progress: true, error: true },
              },
              outputs: {
                select: {
                  id: true,
                  kind: true,
                  format: true,
                  path: true,
                  checksum: true,
                  createdAt: true,
                },
              },
              productionRevision: {
                select: {
                  id: true,
                  projectId: true,
                  scriptId: true,
                  revisionHash: true,
                  source: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      },
    },
  });
  return batch
    ? productionBatchView({
        ...batch,
        items: batch.items.map((item) => ({
          ...item,
          job: item.job
            ? {
                ...item.job,
                steps: item.job.steps.map((step) => ({
                  ...step,
                  detailJson: null,
                })),
                outputs: item.job.outputs.map((output) => ({
                  ...output,
                  metadataJson: null,
                })),
              }
            : null,
        })),
      })
    : null;
}
