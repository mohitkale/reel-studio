"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "./button";

/** Keep cached content visible while making a failed refresh recoverable. */
export function QueryError({
  title,
  error,
  retry,
  pending = false,
}: {
  title: string;
  error?: unknown;
  retry(): unknown;
  pending?: boolean;
}) {
  return (
    <div
      role="alert"
      className="border-destructive/40 bg-destructive/5 flex flex-wrap items-center gap-3 rounded-xl border p-4"
    >
      <AlertTriangle
        aria-hidden="true"
        className="text-destructive size-5 shrink-0"
      />
      <div className="min-w-0 flex-1 basis-48">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground text-sm break-words">
          {error instanceof Error
            ? error.message
            : "Check your connection and try again."}
        </p>
      </div>
      <Button variant="outline" disabled={pending} onClick={() => void retry()}>
        {pending ? "Retrying…" : "Retry"}
      </Button>
    </div>
  );
}
