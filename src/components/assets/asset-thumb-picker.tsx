"use client";

import * as React from "react";

import { LISTING_GRID_6, type ListingViewMode } from "@/lib/listing-layout";
import { cn } from "@/lib/utils";
import { ViewModeToggle } from "@/components/ui/view-mode-toggle";
import { Label } from "@/components/ui/label";

export interface AssetThumbItem {
  id: string;
  url: string;
  name?: string | null;
}

interface AssetThumbPickerProps {
  assets: AssetThumbItem[];
  selectedUrl?: string | null;
  kind?: "image" | "video";
  onSelect: (url: string) => void;
  /** Portrait thumbs (cover) vs landscape (scene background). */
  aspect?: "video" | "portrait";
  label?: string;
  className?: string;
  /** Default grid — 6-up thumbnails; list shows richer per-asset details. */
  defaultView?: ListingViewMode;
}

/**
 * Asset thumbnail picker with list/grid modes. Grid targets 6 columns on wide
 * screens; list shows name, kind, and URL for denser scanning.
 */
export function AssetThumbPicker({
  assets,
  selectedUrl,
  kind = "image",
  onSelect,
  aspect = "video",
  label = "Pick from assets",
  className,
  defaultView = "grid",
}: AssetThumbPickerProps) {
  const [view, setView] = React.useState<ListingViewMode>(defaultView);

  if (assets.length === 0) return null;

  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <ViewModeToggle value={view} onChange={setView} label="Assets" />
      </div>

      {view === "list" ? (
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-1">
          {assets.map((asset) => {
            const selected = selectedUrl === asset.url;
            const fileName = asset.url.split("/").pop() || "asset";
            const title = asset.name?.trim() || fileName;
            return (
              <button
                key={asset.id}
                type="button"
                title={title}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelect(asset.url)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md border px-2 py-1.5 text-left transition-colors",
                  selected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-transparent hover:bg-muted/60",
                )}
              >
                <span
                  className={cn(
                    "shrink-0 overflow-hidden rounded bg-black/40",
                    aspect === "portrait" ? "h-12 w-8" : "h-10 w-14",
                  )}
                >
                  {kind === "video" ? (
                    <video
                      src={asset.url}
                      muted
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={asset.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">
                    {title}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                    {kind === "video" ? "Video" : "Image"}
                    {" · "}
                    {fileName}
                    {selected ? " · Selected" : ""}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-muted-foreground/80">
                    {asset.url}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div
          className={cn(
            LISTING_GRID_6,
            "max-h-52 gap-1 overflow-y-auto rounded-lg border p-1",
          )}
        >
          {assets.map((asset) => {
            const selected = selectedUrl === asset.url;
            return (
              <button
                key={asset.id}
                type="button"
                title={asset.name ?? asset.url}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelect(asset.url)}
                className={cn(
                  "overflow-hidden rounded border bg-black/40 transition-all",
                  aspect === "portrait" ? "aspect-[9/16]" : "aspect-video",
                  selected
                    ? "border-primary ring-2 ring-primary"
                    : "border-border hover:border-primary/50",
                )}
              >
                {kind === "video" ? (
                  <video
                    src={asset.url}
                    muted
                    className="h-full w-full object-cover"
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={asset.url}
                    alt={asset.name ?? ""}
                    className="h-full w-full object-cover"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
