"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import type { SceneDTO } from "@/lib/dto";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function SceneList({
  scenes,
  selectedId,
  onSelect,
  onAdd,
  onMove,
  onDelete,
  busy,
}: {
  scenes: SceneDTO[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onDelete: (id: string) => void;
  busy?: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <h3 className="text-sm font-semibold">Scenes</h3>
        <Button size="sm" variant="outline" onClick={onAdd} disabled={busy}>
          <Plus />
          Add
        </Button>
      </div>

      <ol className="flex-1 space-y-2 overflow-y-auto pr-1">
        {scenes.map((scene, i) => {
          const active = scene.id === selectedId;
          return (
            <li key={scene.id}>
              <div
                className={cn(
                  "group rounded-lg border bg-card p-2.5 transition-colors",
                  active
                    ? "border-primary ring-1 ring-primary"
                    : "hover:border-foreground/20",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(scene.id)}
                  className="flex w-full items-start gap-2 text-left"
                >
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-medium text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="line-clamp-2 text-sm">
                    {scene.text || (
                      <span className="text-muted-foreground">Empty scene</span>
                    )}
                  </span>
                </button>
                <div className="mt-2 flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label="Move scene up"
                    disabled={i === 0 || busy}
                    onClick={() => onMove(scene.id, -1)}
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    aria-label="Move scene down"
                    disabled={i === scenes.length - 1 || busy}
                    onClick={() => onMove(scene.id, 1)}
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="ml-auto size-7 text-muted-foreground hover:text-destructive"
                    aria-label="Delete scene"
                    disabled={busy}
                    onClick={() => onDelete(scene.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
        {scenes.length === 0 ? (
          <li className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            No scenes yet. Add one to begin.
          </li>
        ) : null}
      </ol>
    </div>
  );
}
