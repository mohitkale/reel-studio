"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/** Split text and wrap emphasized phrases in <strong>. Case-insensitive. */
function renderWithEmphasis(text: string, emphasis: string[]): React.ReactNode {
  const phrases = emphasis.filter((p) => p.trim().length > 0);
  if (phrases.length === 0) return text;

  const escaped = phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  return text.split(re).map((part, i) =>
    phrases.some((p) => p.toLowerCase() === part.toLowerCase()) ? (
      <strong key={i} className="text-primary">
        {part}
      </strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
}

/**
 * A 9:16 preview of the current scene. This is a simple typographic stand-in;
 * the live Remotion Player with motion-design templates lands in M4.
 */
export function PreviewFrame({
  text,
  emphasis = [],
  sceneNumber,
  sceneCount,
  playing = false,
}: {
  text: string;
  emphasis?: string[];
  sceneNumber?: number;
  sceneCount?: number;
  playing?: boolean;
}) {
  return (
    <div className="flex justify-center">
      <div
        className={cn(
          "relative flex aspect-[9/16] w-full max-w-[280px] flex-col justify-center overflow-hidden rounded-2xl border p-6 text-center shadow-sm",
          "bg-gradient-to-b from-secondary to-background",
        )}
      >
        <div className="absolute left-3 top-3 rounded-md bg-background/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground backdrop-blur">
          {sceneNumber && sceneCount ? `Scene ${sceneNumber}/${sceneCount}` : "Preview"}
        </div>
        {playing ? (
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" />
            Playing
          </div>
        ) : null}
        <p className="text-balance text-lg font-semibold leading-snug">
          {text ? renderWithEmphasis(text, emphasis) : (
            <span className="text-muted-foreground">Empty scene</span>
          )}
        </p>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] text-muted-foreground">
          1080 x 1920
        </div>
      </div>
    </div>
  );
}
