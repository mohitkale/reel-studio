"use client";

import { useMemo, useState } from "react";
import type { ReelBeat, ReelScene } from "@/video/types";
import type { ScriptDTO } from "@/lib/dto";
import { sequenceConfigFor } from "@/video/sequence-direction";
import { resolveSequenceContinuity } from "@/production/sequence-continuity";
import { MOTION_RECIPES } from "@/production/motion";
import { semanticStorySource } from "@/production/semantic-direction";
import { EnginePlayer } from "./engine-player";
import { Button } from "@/components/ui/button";

/** Mount only a bounded page of real local previews, on demand. */
export function FilmContactSheet({
  script,
  scenes,
  timeline,
  fps,
  measured,
  onSelect,
  onAnimatic,
}: {
  script: ScriptDTO;
  scenes: ReelScene[];
  timeline: ReelBeat[];
  fps: number;
  measured: boolean;
  onSelect(id: string): void;
  onAnimatic(): void;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const sequence = useMemo(
    () =>
      open
        ? resolveSequenceContinuity({
            scenes,
            timeline,
            fps,
            width: script.width,
            height: script.height,
            tokens: script.brandTokens,
            coverUrl: script.coverUrl ?? undefined,
            sequenceDirection: sequenceConfigFor(script.motionPlan),
          })
        : undefined,
    [
      open,
      scenes,
      timeline,
      fps,
      script.width,
      script.height,
      script.brandTokens,
      script.coverUrl,
      script.motionPlan,
    ],
  );
  const pages = Math.max(1, Math.ceil(scenes.length / 4));
  const currentPage = Math.min(page, pages - 1);
  return (
    <details
      className="bg-card rounded-xl border p-3"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer text-sm font-semibold">
        Contact sheet and animatic
      </summary>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs">
              {measured ? "Narration timing" : "Estimated timing"} · Review
              purpose and pacing before generating voice or exporting.
            </p>
            <Button variant="outline" size="sm" onClick={onAnimatic}>
              Play animatic
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {scenes
              .slice(currentPage * 4, currentPage * 4 + 4)
              .map((scene, index) => {
                const beat = timeline.find((beat) => beat.sceneId === scene.id);
                const boundary = sequence?.boundaries.find(
                  (boundary) => boundary.fromSceneId === scene.id,
                );
                const durationFrames = beat?.durationFrames ?? fps * 5;
                return (
                  <article
                    key={scene.id}
                    className="min-w-0 rounded-lg border p-2"
                  >
                    <EnginePlayer
                      videoEngine={script.videoEngine}
                      scenes={[scene]}
                      timeline={[
                        { sceneId: scene.id, startFrame: 0, durationFrames },
                      ]}
                      totalFrames={durationFrames}
                      fps={fps}
                      width={script.width}
                      height={script.height}
                      tokens={script.brandTokens}
                      styleId={script.styleId}
                      energy={script.energy}
                      preset={script.productionPreset}
                      storySource={semanticStorySource(scenes)}
                      sequenceDirection={sequenceConfigFor(script.motionPlan)}
                      autoPlay={false}
                      loop={false}
                    />
                    <button
                      type="button"
                      className="mt-2 w-full text-left text-sm font-medium"
                      onClick={() => onSelect(scene.id)}
                    >
                      Scene {currentPage * 4 + index + 1} ·{" "}
                      {(durationFrames / fps).toFixed(1)}s
                    </button>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {scene.role ?? "Scene"} ·{" "}
                      {MOTION_RECIPES.find(
                        (recipe) => recipe.id === scene.motion?.recipeId,
                      )?.name ?? "Preset look"}
                      {scene.locks?.scene ? " · Locked" : ""}
                    </p>
                    <p className="mt-1 text-sm">{scene.text}</p>
                    {boundary && (
                      <p className="text-muted-foreground mt-1 text-xs">
                        Next:{" "}
                        {boundary.kind === "shared-card"
                          ? "Subject handoff"
                          : "Saved transition"}{" "}
                        · {boundary.reason}
                      </p>
                    )}
                    <p className="text-muted-foreground mt-1 text-xs">
                      {scene.motion?.decision?.reason ??
                        "Saved treatment and supplied content."}
                    </p>
                  </article>
                );
              })}
          </div>
          <div className="flex items-center justify-center gap-3">
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </Button>
            <span className="text-xs">
              {currentPage + 1} / {pages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage + 1 >= pages}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </details>
  );
}
