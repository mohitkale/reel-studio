"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPost } from "@/lib/api-client";
import type { ScriptDTO } from "@/lib/dto";
import { MOTION_RECIPES } from "@/production/motion";
import type { DirectionProposal } from "@/production/direction-workflow";
import {
  VISUAL_AMBITION_LABELS,
  type VisualAmbition,
} from "@/production/motion-plan";
import { MOTION_SYSTEMS, type MotionSystem } from "@/production/motion-systems";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface DirectionChoice {
  ambition?: VisualAmbition;
  newVariation?: boolean;
  adaptiveRecipes?: boolean;
  sequenceDirection?: boolean;
  chapterMotifs?: boolean;
  system?: MotionSystem;
}

export function DirectionWorkflowDialog({
  scriptId,
  scenes,
  chapters,
  selectedId,
  input,
  onClose,
}: {
  scriptId: string;
  scenes: readonly { id: string; text?: string }[];
  chapters?: ScriptDTO["chapterPlan"];
  selectedId?: string;
  input: DirectionChoice | null;
  onClose(): void;
}) {
  const qc = useQueryClient();
  const [scope, setScope] = useState("film");
  const [proposal, setProposal] = useState<DirectionProposal | null>(null);
  const selectedIndex = scenes.findIndex((scene) => scene.id === selectedId);
  const chapterIndex =
    chapters?.chapters.findLastIndex(
      (chapter) =>
        scenes.findIndex((scene) => scene.id === chapter.firstSceneId) <=
        selectedIndex,
    ) ?? -1;
  const chapter = chapters?.chapters[chapterIndex];
  const end = chapters?.chapters[chapterIndex + 1];
  const scopedIds =
    scope === "scene"
      ? [selectedId!]
      : scope === "chapter" && chapter
        ? scenes
            .slice(
              scenes.findIndex((scene) => scene.id === chapter.firstSceneId),
              end
                ? scenes.findIndex((scene) => scene.id === end.firstSceneId)
                : undefined,
            )
            .map((scene) => scene.id)
        : undefined;
  const request = useMutation({
    mutationFn: (mode: "preview" | "apply" | "undo") =>
      apiPost<{ result: DirectionProposal; script: ScriptDTO }>(
        `/api/scripts/${scriptId}/motion`,
        mode === "undo"
          ? { undo: true }
          : {
              ...input,
              sceneIds: scopedIds,
              preview: mode === "preview",
              ...(mode === "apply" && proposal
                ? {
                    expectedHash: proposal.sourceHash,
                    variationSeed: proposal.settings.seed,
                  }
                : {}),
            },
      ),
    onSuccess: (data, mode) => {
      if (mode === "preview") setProposal(data.result);
      else {
        qc.setQueryData(["script", scriptId], data.script);
        void qc.invalidateQueries({ queryKey: ["script", scriptId] });
        toast.success(
          mode === "undo"
            ? "Previous direction restored"
            : "Visual direction saved",
        );
        setProposal(null);
        onClose();
      }
    },
    onError: (error) => {
      setProposal(null);
      toast.error(error.message);
    },
  });
  return (
    <Dialog
      open={input !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review visual direction</DialogTitle>
          <DialogDescription>
            Copy, narration, data, media, brand and whole-scene locks are
            preserved. Review compatible treatment changes before applying.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm font-medium">
          {[
            input?.system
              ? MOTION_SYSTEMS.find((system) => system.id === input.system)
                  ?.name
              : undefined,
            input?.ambition
              ? VISUAL_AMBITION_LABELS[input.ambition]
              : undefined,
            input?.newVariation ? "Another compatible composition" : undefined,
            input?.adaptiveRecipes !== undefined
              ? `Adaptive recipes ${input.adaptiveRecipes ? "on" : "off"}`
              : undefined,
            input?.sequenceDirection !== undefined
              ? `Sequence direction ${input.sequenceDirection ? "on" : "off"}`
              : undefined,
            input?.chapterMotifs !== undefined
              ? `Chapter motifs ${input.chapterMotifs ? "on" : "off"}`
              : undefined,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <label className="grid gap-2 text-sm">
          Apply to
          <select
            aria-label="Variation scope"
            className="bg-background rounded-md border p-2"
            value={scope}
            disabled={request.isPending}
            onChange={(event) => {
              setScope(event.target.value);
              setProposal(null);
            }}
          >
            <option value="film">Whole film</option>
            <option value="scene" disabled={!selectedId}>
              Selected scene
            </option>
            <option value="chapter" disabled={!chapter}>
              Selected chapter{chapter ? ` · ${chapter.title}` : ""}
            </option>
          </select>
        </label>
        {proposal && (
          <div role="status" className="space-y-2 text-sm">
            <p>
              {proposal.changes.length}{" "}
              {proposal.changes.length === 1 ? "scene" : "scenes"} will change ·{" "}
              {proposal.protectedSceneCount} protected or outside scope.
            </p>
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {proposal.changes.map((change) => (
                <li key={change.sceneId} className="rounded border p-2">
                  <strong>
                    Scene{" "}
                    {scenes.findIndex((scene) => scene.id === change.sceneId) +
                      1}
                  </strong>
                  <p>
                    {MOTION_RECIPES.find(
                      (recipe) => recipe.id === change.before,
                    )?.name ?? "Preset look"}{" "}
                    →{" "}
                    {MOTION_RECIPES.find((recipe) => recipe.id === change.after)
                      ?.name ?? "Preset look"}
                  </p>
                  {change.beforeSystem !== change.afterSystem && (
                    <p className="text-xs">
                      Visual family:{" "}
                      {MOTION_SYSTEMS.find(
                        (system) => system.id === change.beforeSystem,
                      )?.name ?? "Preset"}{" "}
                      →{" "}
                      {MOTION_SYSTEMS.find(
                        (system) => system.id === change.afterSystem,
                      )?.name ?? "Preset"}
                    </p>
                  )}
                  {change.before === change.after &&
                    change.beforeSystem === change.afterSystem && (
                      <p className="text-muted-foreground text-xs">
                        Choreography or direction updated within this treatment.
                      </p>
                    )}
                </li>
              ))}
            </ul>
            {!proposal.changes.length && (
              <p>No scene treatments need to change in this scope.</p>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={request.isPending}
            variant="outline"
            onClick={() => request.mutate("preview")}
          >
            {request.isPending ? "Working…" : "Review changes"}
          </Button>
          <Button
            disabled={request.isPending || !proposal}
            onClick={() => request.mutate("apply")}
          >
            Apply direction
          </Button>
          <Button
            disabled={request.isPending}
            variant="ghost"
            onClick={() => request.mutate("undo")}
          >
            Undo last direction
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Undo is saved locally and survives restart. A later scene or direction
          edit requires a fresh review and can make undo unavailable.
        </p>
      </DialogContent>
    </Dialog>
  );
}
