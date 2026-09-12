"use client";

import {
  Download,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  StopCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  useApproveProductionJob,
  useCancelProductionJob,
  useProductionJobs,
  useRetryProductionJob,
} from "@/hooks/production-jobs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ProductionJobList() {
  const query = useProductionJobs();
  const approve = useApproveProductionJob();
  const cancel = useCancelProductionJob();
  const retry = useRetryProductionJob();

  if (query.isLoading) return <Skeleton className="h-24 rounded-xl" />;
  if (!query.data?.jobs.length) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Automated production</h2>
        <p className="text-muted-foreground text-xs">
          Durable video, audio, podcast and audiogram jobs submitted through the
          studio or MCP.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {query.data.jobs.map((job) => (
          <Card key={job.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium capitalize">
                    {job.kind} production
                  </p>
                  <p className="text-muted-foreground font-mono text-[11px]">
                    {job.id.slice(-10)}
                  </p>
                </div>
                <Badge
                  variant={job.state === "failed" ? "destructive" : "outline"}
                >
                  {job.state.replaceAll("_", " ")}
                </Badge>
              </div>

              {job.state === "running" || job.state === "queued" ? (
                <div className="space-y-1">
                  <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full transition-all"
                      style={{ width: `${Math.round(job.progress * 100)}%` }}
                    />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {Math.round(job.progress * 100)}% complete
                  </p>
                </div>
              ) : null}

              {job.error ? (
                <p className="bg-destructive/10 text-destructive rounded-md p-2 text-xs">
                  {job.error}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {job.state === "awaiting_approval" ? (
                  <Button
                    size="sm"
                    disabled={approve.isPending}
                    onClick={() =>
                      approve.mutate(job.id, {
                        onSuccess: () => toast.success("Production approved"),
                      })
                    }
                  >
                    <ShieldCheck className="size-3.5" /> Approve
                  </Button>
                ) : null}
                {["queued", "running", "awaiting_approval"].includes(
                  job.state,
                ) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={cancel.isPending}
                    onClick={() => cancel.mutate(job.id)}
                  >
                    <StopCircle className="size-3.5" /> Cancel
                  </Button>
                ) : null}
                {["failed", "canceled"].includes(job.state) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={retry.isPending}
                    onClick={() => retry.mutate(job.id)}
                  >
                    <RefreshCcw className="size-3.5" /> Retry
                  </Button>
                ) : null}
                {job.outputs.map((output) => (
                  <Button key={output.id} size="sm" variant="outline" asChild>
                    <a href={output.downloadUrl} download>
                      <Download className="size-3.5" />{" "}
                      {output.format.toUpperCase()}
                    </a>
                  </Button>
                ))}
                {job.state === "running" ? (
                  <Loader2 className="text-muted-foreground size-4 animate-spin" />
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
