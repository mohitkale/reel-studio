"use client";

import {
  VIDEO_ENGINE_DESCRIPTIONS,
  VIDEO_ENGINE_LABELS,
  type VideoEngineId,
} from "@/engines/types";
import { Badge } from "@/components/ui/badge";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { cn } from "@/lib/utils";

const ENGINE_HINT: Record<VideoEngineId, string> = {
  remotion:
    "Remotion engine — React templates and mature preview. Remotion License (company license may apply).",
  hyperframes:
    "HyperFrames engine — HTML-native templates, Apache 2.0. Best for commercially open rendering.",
};

/**
 * Clear engine marker for project cards and the editor header.
 */
export function EngineBadge({
  engine,
  className,
  size = "default",
}: {
  engine: VideoEngineId;
  className?: string;
  size?: "default" | "lg";
}) {
  const label = VIDEO_ENGINE_LABELS[engine] ?? engine;
  const description = VIDEO_ENGINE_DESCRIPTIONS[engine] ?? "";

  return (
    <HintTooltip label={ENGINE_HINT[engine] ?? description} side="bottom">
      <Badge
        variant={engine === "hyperframes" ? "success" : "default"}
        className={cn(
          "cursor-default font-semibold tracking-wide",
          size === "lg" && "px-3 py-1 text-sm",
          className,
        )}
      >
        {label}
      </Badge>
    </HintTooltip>
  );
}
