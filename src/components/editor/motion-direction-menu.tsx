"use client";

import {
  ChevronDown,
  Clapperboard,
  Loader2,
  TriangleAlert,
} from "lucide-react";
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
import { MOTION_RECIPES } from "@/production/motion";
import {
  VISUAL_AMBITIONS,
  VISUAL_AMBITION_DESCRIPTIONS,
  VISUAL_AMBITION_LABELS,
  type VisualAmbition,
} from "@/production/motion-plan";
import {
  reviewMotionTreatments,
  reviewMotionRepetition,
  type MotionReviewScene,
} from "@/production/motion-review";

export function MotionDirectionMenu({
  scriptId,
  ambition,
  scenes,
  onSelectScene,
}: {
  scriptId: string;
  ambition: VisualAmbition;
  scenes: readonly MotionReviewScene[];
  onSelectScene: (id: string) => void;
}) {
  const replan = useReplanMotionDirection(scriptId);
  const issues = reviewMotionTreatments(scenes);
  const repetitions = reviewMotionRepetition(scenes);
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
            aria-label={`Visual direction: ${VISUAL_AMBITION_LABELS[ambition]}${issues.length ? `, ${issues.length} treatment warnings` : ""}`}
          >
            {replan.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Clapperboard className="size-3.5" />
            )}
            {VISUAL_AMBITION_LABELS[ambition]}
            {issues.length > 0 && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <TriangleAlert className="size-3.5" />
                {issues.length}
              </span>
            )}
            <ChevronDown className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
      </HintTooltip>
      <DropdownMenuContent
        align="end"
        className="max-h-[var(--radix-dropdown-menu-content-available-height)] w-80 overflow-y-auto"
      >
        <DropdownMenuLabel>Treatment checks</DropdownMenuLabel>
        {issues.length ? (
          <>
            <p className="text-muted-foreground px-2 pb-2 text-xs">
              These scenes use the preset look until their treatment fits.
              Select a scene to adjust it.
            </p>
            <div className="max-h-48 overflow-y-auto">
              {issues.map((issue) => (
                <DropdownMenuItem
                  key={issue.sceneId}
                  onSelect={() => onSelectScene(issue.sceneId)}
                  className="items-start"
                >
                  <div>
                    <p>Scene {issue.sceneNumber}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {issue.reason}
                    </p>
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground px-2 pb-2 text-xs">
            No treatment compatibility issues. Preview to review readability and
            timing.
          </p>
        )}
        {repetitions.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Variety suggestions</DropdownMenuLabel>
            <p className="text-muted-foreground px-2 pb-2 text-xs">
              Three or more consecutive scenes share a treatment. Keep it for
              continuity, or change a scene for contrast.
            </p>
            <div className="max-h-48 overflow-y-auto">
              {repetitions.map((run) => (
                <DropdownMenuItem
                  key={run.sceneId}
                  onSelect={() => onSelectScene(run.sceneId)}
                  className="items-start"
                >
                  <div>
                    <p>
                      Scenes {run.firstSceneNumber}–{run.lastSceneNumber}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {
                        MOTION_RECIPES.find(
                          (recipe) => recipe.id === run.recipeId,
                        )?.name
                      }
                      {" · Select to review"}
                    </p>
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
          </>
        )}
        <DropdownMenuSeparator />
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
