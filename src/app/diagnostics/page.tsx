"use client";

import Link from "next/link";
import {
  CheckCircle2,
  CircleAlert,
  CircleX,
  Loader2,
  RefreshCw,
  TerminalSquare,
} from "lucide-react";

import { useStudioDiagnostics } from "@/hooks/diagnostics";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const statusIcon = {
  pass: CheckCircle2,
  warn: CircleAlert,
  fail: CircleX,
} as const;

const statusClass = {
  pass: "text-success",
  warn: "text-warning",
  fail: "text-destructive",
} as const;

export default function DiagnosticsPage() {
  const diagnostics = useStudioDiagnostics();
  const report = diagnostics.data;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Production diagnostics"
        description="Verify the local runtime before a render, podcast, or unattended batch."
        actions={
          <Button
            variant="outline"
            onClick={() => diagnostics.refetch()}
            disabled={diagnostics.isFetching}
          >
            {diagnostics.isFetching ? (
              <Loader2 className="animate-spin" />
            ) : (
              <RefreshCw />
            )}
            Run checks
          </Button>
        }
      />

      {diagnostics.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
      ) : diagnostics.isError || !report ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base">Checks could not run</CardTitle>
            <CardDescription>
              {diagnostics.error instanceof Error
                ? diagnostics.error.message
                : "The diagnostics endpoint did not return a report."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <Card
            className={
              report.ready ? "border-success/40" : "border-destructive/40"
            }
          >
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
              <div className="space-y-1.5">
                <CardTitle>
                  {report.ready
                    ? "Ready for local production"
                    : "Production setup needs attention"}
                </CardTitle>
                <CardDescription>
                  {report.platform} · checked{" "}
                  {new Date(report.generatedAt).toLocaleString()}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">{report.summary.passed} passed</Badge>
                {report.summary.warnings ? (
                  <Badge variant="warning">
                    {report.summary.warnings} optional
                  </Badge>
                ) : null}
                {report.summary.failed ? (
                  <Badge variant="destructive">
                    {report.summary.failed} failed
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {report.checks.map((check) => {
              const Icon = statusIcon[check.status];
              return (
                <Card key={check.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      <Icon
                        className={`mt-0.5 size-5 ${statusClass[check.status]}`}
                      />
                      <div className="min-w-0 space-y-1">
                        <CardTitle className="text-base">
                          {check.label}
                        </CardTitle>
                        <CardDescription>{check.detail}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  {check.fix ? (
                    <CardContent>
                      <p className="bg-muted rounded-md px-3 py-2 font-mono text-xs">
                        {check.fix}
                      </p>
                    </CardContent>
                  ) : null}
                </Card>
              );
            })}
          </div>
        </>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TerminalSquare className="text-primary size-5" />
            <CardTitle>Credential-free proof</CardTitle>
          </div>
          <CardDescription>
            Render the bundled HyperFrames project with local placeholder
            speech.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <code className="bg-muted rounded-md px-3 py-2 text-sm">
            npm run sample:export
          </code>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/gallery">View gallery</Link>
            </Button>
            <Button asChild>
              <Link href="/">Create production</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
