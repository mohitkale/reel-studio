"use client";

import {
  ArchiveRestore,
  Download,
  Layers3,
  ShieldCheck,
  StopCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  useApproveProductionBatch,
  useCancelProductionBatch,
  useProductionBatches,
  useRetryProductionBatch,
} from "@/hooks/production-batches";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ProductionBatchList() {
  const query = useProductionBatches();
  const approve = useApproveProductionBatch();
  const cancel = useCancelProductionBatch();
  const retry = useRetryProductionBatch();

  if (query.isLoading) return <Skeleton className="h-24 rounded-xl" />;
  if (!query.data?.batches.length) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Production batches</h2>
        <p className="text-muted-foreground text-xs">
          Each row is reflowed independently for its requested portrait, square
          and landscape variants. Completed items stay available if another item
          fails.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {query.data.batches.map((batch) => (
          <Card key={batch.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Layers3 className="text-muted-foreground size-4" />
                  <div>
                    <p className="text-sm font-medium">
                      {batch.totalItems} production variants
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {batch.succeededItems} complete
                      {batch.failedItems
                        ? ` · ${batch.failedItems} failed`
                        : ""}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={
                    ["failed", "partial_failure"].includes(batch.state)
                      ? "destructive"
                      : "outline"
                  }
                >
                  {batch.state.replaceAll("_", " ")}
                </Badge>
              </div>

              <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full transition-all"
                  style={{ width: `${Math.round(batch.progress * 100)}%` }}
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {batch.items.map((item) => (
                  <Badge key={item.id} variant="secondary">
                    {item.label ?? `Row ${item.rowIndex + 1}`}
                    {item.orientation ? ` · ${item.orientation}` : ""}
                    {` · ${item.state.replaceAll("_", " ")}`}
                  </Badge>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {batch.state === "awaiting_approval" ? (
                  <Button
                    size="sm"
                    disabled={approve.isPending}
                    onClick={() =>
                      approve.mutate(batch.id, {
                        onSuccess: () => toast.success("Batch approved"),
                      })
                    }
                  >
                    <ShieldCheck className="size-3.5" /> Approve all
                  </Button>
                ) : null}
                {["queued", "running", "awaiting_approval"].includes(
                  batch.state,
                ) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={cancel.isPending}
                    onClick={() => cancel.mutate(batch.id)}
                  >
                    <StopCircle className="size-3.5" /> Cancel batch
                  </Button>
                ) : null}
                {["failed", "partial_failure", "canceled"].includes(
                  batch.state,
                ) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={retry.isPending}
                    onClick={() => retry.mutate(batch.id)}
                  >
                    <ArchiveRestore className="size-3.5" /> Retry incomplete
                  </Button>
                ) : null}
                {batch.succeededItems ? (
                  <Button size="sm" variant="outline" asChild>
                    <a href={batch.bundleUrl} download>
                      <Download className="size-3.5" /> Download bundle
                    </a>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
