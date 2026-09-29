"use client";

import { ChevronDown, Clapperboard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { useReplanMotionDirection } from "@/hooks/script";
import {
  VISUAL_AMBITIONS,
  VISUAL_AMBITION_DESCRIPTIONS,
  VISUAL_AMBITION_LABELS,
  type VisualAmbition,
} from "@/production/motion-plan";

export function MotionDirectionMenu({
  scriptId,
  ambition,
}: {
  scriptId: string;
  ambition: VisualAmbition;
}) {
  const replan = useReplanMotionDirection(scriptId);
  function apply(input: { ambition?: VisualAmbition; newVariation?: boolean }) {
    replan.mutate(input, {
      onSuccess: ({ result }) =>
        toast.success(
          result.changedSceneIds.length
            ? `Updated direction in ${result.changedSceneIds.length} scenes`
            : "Direction reviewed",
          {
            description: result.changedSceneIds.length
              ? "Copy, narration and media are preserved. Locked and hidden-text scenes keep their direction."
              : "No treatments changed. Locked and hidden-text scenes are protected; other scenes may have only one compatible treatment.",
          },
        ),
      onError: (error) => toast.error(error.message),
    });
  }
  return (
    <DropdownMenu>
      <HintTooltip
        label="Replan visual treatments across this video. Lock a scene to protect its chosen treatment."
        side="bottom"
      >
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            disabled={replan.isPending}
            aria-label={`Visual direction: ${VISUAL_AMBITION_LABELS[ambition]}`}
          >
            {replan.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Clapperboard className="size-3.5" />
            )}
            {VISUAL_AMBITION_LABELS[ambition]}
            <ChevronDown className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
      </HintTooltip>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Replan visual direction</DropdownMenuLabel>
        {VISUAL_AMBITIONS.map((value) => (
          <DropdownMenuItem
            key={value}
            onSelect={() => apply({ ambition: value })}
            className="items-start"
          >
            <div>
              <p>
                {VISUAL_AMBITION_LABELS[value]}
                {value === ambition ? " · current" : ""}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {VISUAL_AMBITION_DESCRIPTIONS[value]}
              </p>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => apply({ newVariation: true })}>
          Try another variation
        </DropdownMenuItem>
        <p className="text-muted-foreground px-2 py-2 text-xs">
          Uses compatible treatments. Supplied values and diagram order are
          preserved.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
