"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import type { ReelBeat } from "@/video/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Selection seeks the shared player; reorder uses the existing saved scene API. */
export function SceneTimeline({
  scenes,
  timeline,
  fps,
  selectedId,
  onSelect,
  onMove,
  busy,
  measured,
}: {
  scenes: readonly { id: string; text: string }[];
  timeline: readonly ReelBeat[];
  fps: number;
  selectedId: string | null;
  onSelect(id: string): void;
  onMove(id: string, direction: -1 | 1): void;
  busy: boolean;
  measured: boolean;
}) {
  return (
    <section
      aria-label="Scene timeline"
      className="bg-card min-w-0 rounded-xl border p-3"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Timeline</h3>
        <p className="text-muted-foreground text-xs">
          {measured ? "Narration timing" : "Estimated timing"} · Select to
          preview · Reorder to customize
        </p>
      </div>
      <ol className="flex gap-2 overflow-x-auto pb-2">
        {scenes.map((scene, index) => {
          const beat = timeline.find((item) => item.sceneId === scene.id);
          const seconds = (beat?.durationFrames ?? 1) / fps;
          return (
            <li
              key={scene.id}
              className={cn(
                "shrink-0 rounded-lg border p-2",
                selectedId === scene.id && "border-primary bg-primary/5",
              )}
              style={{ width: Math.max(140, Math.min(240, seconds * 40)) }}
            >
              <button
                type="button"
                aria-label={`Preview scene ${index + 1}`}
                aria-pressed={selectedId === scene.id}
                onClick={() => onSelect(scene.id)}
                className="focus-visible:outline-primary w-full text-left"
              >
                <span className="text-muted-foreground block text-xs">
                  {index + 1} · {((beat?.startFrame ?? 0) / fps).toFixed(1)}s ·{" "}
                  {seconds.toFixed(1)}s
                </span>
                <span className="mt-1 block truncate text-sm">
                  {scene.text || "Empty scene"}
                </span>
              </button>
              <div className="mt-2 flex justify-between">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  aria-label={`Move scene ${index + 1} earlier`}
                  disabled={index === 0 || busy}
                  onClick={() => onMove(scene.id, -1)}
                >
                  <ArrowLeft className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  aria-label={`Move scene ${index + 1} later`}
                  disabled={index === scenes.length - 1 || busy}
                  onClick={() => onMove(scene.id, 1)}
                >
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
