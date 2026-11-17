"use client";

import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { useSetUiMode, useUiMode, type UiMode } from "@/hooks/ui-mode";

const MODES: { id: UiMode; label: string; hint: string }[] = [
  { id: "simple", label: "Simple", hint: "Describe a video and get it made" },
  { id: "pro", label: "Pro", hint: "Every editor and manual control" },
];

/** Header switch between Simple and Pro. Switching never changes any data. */
export function ModeSwitch({ className }: { className?: string }) {
  const { mode, ready } = useUiMode();
  const set = useSetUiMode();
  if (!ready) return null;

  return (
    <div
      role="radiogroup"
      aria-label="Studio mode"
      className={cn("bg-muted inline-flex rounded-md p-0.5", className)}
    >
      {MODES.map((option) => {
        const active = option.id === mode;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.hint}
            disabled={set.isPending}
            onClick={() => {
              if (!active)
                set.mutate(
                  { mode: option.id },
                  {
                    onError: (error) =>
                      toast.error("Could not switch mode", {
                        description: error.message,
                      }),
                  },
                );
            }}
            className={cn(
              "focus-visible:ring-ring rounded px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
