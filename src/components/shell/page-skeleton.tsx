import * as React from "react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholders that mirror the standard page chrome (see `PageHeader`).
 * Used by route-level `loading.tsx` files so navigation shows an instant
 * skeleton while the segment streams in, before each page's own data-loading
 * states take over.
 */

interface PageHeaderSkeletonProps {
  /** Render a placeholder for the description line below the title. */
  description?: boolean;
  /** Number of right-aligned action-button placeholders to render. */
  actions?: number;
}

export function PageHeaderSkeleton({
  description = true,
  actions = 0,
}: PageHeaderSkeletonProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        {description ? <Skeleton className="h-4 w-72 max-w-full" /> : null}
      </div>
      {actions > 0 ? (
        <div className="flex items-center gap-2">
          {Array.from({ length: actions }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-32" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface CardGridSkeletonProps {
  count?: number;
  itemClassName?: string;
  className?: string;
}

export function CardGridSkeleton({
  count = 6,
  itemClassName = "h-36",
  className = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
}: CardGridSkeletonProps) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn(itemClassName)} />
      ))}
    </div>
  );
}
