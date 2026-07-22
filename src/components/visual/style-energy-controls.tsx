"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";

import {
  ENERGY_META,
  STYLE_META,
  type EnergyId,
  type StyleId,
} from "@/compositions/visual-style";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type StylePick = StyleId | "auto";
export type EnergyPick = EnergyId | "auto";

/** Compact Style + Energy pickers with plain-English help. */
export function StyleEnergyControls({
  styleId,
  energy,
  onStyleChange,
  onEnergyChange,
  allowAuto = false,
  compact = false,
}: {
  styleId: StylePick;
  energy: EnergyPick;
  onStyleChange: (v: StylePick) => void;
  onEnergyChange: (v: EnergyPick) => void;
  allowAuto?: boolean;
  compact?: boolean;
}) {
  const [helpOpen, setHelpOpen] = React.useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Label>Style</Label>
          <HintTooltip
            label="How the whole video looks — text energy, decorations, and transitions."
            side="top"
          >
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setHelpOpen(true)}
              aria-label="What is Style and Energy?"
            >
              <HelpCircle className="size-3.5" />
            </button>
          </HintTooltip>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setHelpOpen(true)}
        >
          What is this?
        </Button>
      </div>

      <div className={cn("grid gap-2", compact ? "grid-cols-2" : "sm:grid-cols-2")}>
        {allowAuto ? (
          <PickCard
            active={styleId === "auto"}
            title="Auto"
            description="Let AI pick the best look for your topic."
            onClick={() => onStyleChange("auto")}
          />
        ) : null}
        {STYLE_META.map((s) => (
          <PickCard
            key={s.id}
            active={styleId === s.id}
            title={s.label}
            description={compact ? s.short : `${s.short} ${s.when}`}
            onClick={() => onStyleChange(s.id)}
          />
        ))}
      </div>

      <div className="space-y-2">
        <Label>Energy</Label>
        <div className={cn("grid gap-2", allowAuto ? "grid-cols-4" : "grid-cols-3")}>
          {allowAuto ? (
            <button
              type="button"
              onClick={() => onEnergyChange("auto")}
              className={cn(
                "rounded-lg border px-2 py-2 text-center text-xs font-medium transition-colors",
                energy === "auto"
                  ? "border-primary bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              Auto
            </button>
          ) : null}
          {ENERGY_META.map((e) => (
            <HintTooltip key={e.id} label={e.short} side="bottom">
              <button
                type="button"
                onClick={() => onEnergyChange(e.id)}
                className={cn(
                  "w-full rounded-lg border px-2 py-2 text-center text-xs font-medium transition-colors",
                  energy === e.id
                    ? "border-primary bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                {e.label}
              </button>
            </HintTooltip>
          ))}
        </div>
        {allowAuto ? (
          <p className="text-[11px] text-muted-foreground">
            Tip: leave Style on <strong className="font-medium text-foreground">Bold Hook</strong> and
            Energy on <strong className="font-medium text-foreground">Normal</strong> for most growth content.
          </p>
        ) : null}
      </div>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Style and Energy</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">Style</strong> is the overall look of
                  the whole video — how bold the text feels, how much decoration you see,
                  and how scenes change into each other. Pick one Style per video so your
                  account looks consistent.
                </p>
                <ul className="list-disc space-y-1 pl-4">
                  {STYLE_META.map((s) => (
                    <li key={s.id}>
                      <strong className="text-foreground">{s.label}</strong> — {s.short}{" "}
                      {s.when}
                    </li>
                  ))}
                </ul>
                <p>
                  <strong className="text-foreground">Energy</strong> only changes pace:
                  Calm is slower, High is snappier. Your words and brand colors stay the same.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="sm" onClick={() => setHelpOpen(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PickCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "text-muted-foreground hover:bg-accent",
      )}
    >
      <span className="font-medium">{title}</span>
      <span className="text-xs opacity-80">{description}</span>
    </button>
  );
}
