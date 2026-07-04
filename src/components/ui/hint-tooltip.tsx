"use client";

import * as React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Short hover hint for icon buttons and collapsed nav items. */
export function HintTooltip({
  label,
  children,
  side = "bottom",
  align = "center",
}: {
  label: string;
  children: React.ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align} className="max-w-xs text-center">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
