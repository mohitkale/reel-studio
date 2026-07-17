"use client";

import { LayoutGrid, List } from "lucide-react";

import type { ListingViewMode } from "@/lib/listing-layout";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ViewModeToggleProps {
  value: ListingViewMode;
  onChange: (mode: ListingViewMode) => void;
  className?: string;
  /** Accessible label prefix, e.g. "Projects". */
  label?: string;
}

/** Compact list / grid switcher for listing pages and pickers. */
export function ViewModeToggle({
  value,
  onChange,
  className,
  label = "View",
}: ViewModeToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border bg-muted/40 p-0.5",
        className,
      )}
      role="group"
      aria-label={`${label} mode`}
    >
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={cn(
          "size-8 rounded-md",
          value === "list" && "bg-background text-foreground shadow-sm",
        )}
        aria-label={`${label} list`}
        aria-pressed={value === "list"}
        onClick={() => onChange("list")}
      >
        <List className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={cn(
          "size-8 rounded-md",
          value === "grid" && "bg-background text-foreground shadow-sm",
        )}
        aria-label={`${label} grid`}
        aria-pressed={value === "grid"}
        onClick={() => onChange("grid")}
      >
        <LayoutGrid className="size-4" />
      </Button>
    </div>
  );
}
