"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Grid2X2, Loader2, Smartphone } from "lucide-react";
import { apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { VisualReviewResult } from "@/production/visual-review";

export function VisualReviewDialog({
  scriptId,
  scenes,
  selectedSceneId,
  voiceTakeId,
  sourceKey,
  onSelectScene,
}: {
  scriptId: string;
  scenes: readonly { id: string; text: string }[];
  selectedSceneId: string | null;
  voiceTakeId?: string;
  /** Changes with saved scene, timing, brand or caption edits. */
  sourceKey: string;
  onSelectScene: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [phoneSize, setPhoneSize] = React.useState(false);
  const safePage = Math.min(
    page,
    Math.max(0, Math.ceil(scenes.length / 8) - 1),
  );
  const pageScenes = scenes.slice(safePage * 8, safePage * 8 + 8);
  const review = useMutation({
    mutationFn: async (input: {
      sceneIds: string[];
      samples: 1 | 4;
      sourceKey: string;
      mode: "scene" | "transition";
      repairPasses: 0 | 1;
    }) => ({
      ...(await apiPost<{ review: VisualReviewResult }>(
        `/api/scripts/${scriptId}/review`,
        {
          sceneIds: input.sceneIds,
          samples: input.samples,
          voiceTakeId,
          mode: input.mode,
          repairPasses: input.repairPasses,
        },
      )),
      sourceKey: input.sourceKey,
    }),
    onSuccess: (data) => {
      if (data.review.repair?.repairedSceneIds.length)
        void queryClient.invalidateQueries({ queryKey: ["script", scriptId] });
    },
  });
  const current =
    review.data?.sourceKey === sourceKey ? review.data.review : null;
  const stale = Boolean(review.data && !current);
  function generate(
    sceneIds: string[],
    samples: 1 | 4,
    mode: "scene" | "transition" = "scene",
    repairPasses: 0 | 1 = 0,
  ) {
    review.mutate({ sceneIds, samples, sourceKey, mode, repairPasses });
  }
  function changePage(next: number) {
    review.reset();
    setPage(next);
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={!scenes.length}>
          <Grid2X2 className="size-3.5" /> Visual review
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Visual review</DialogTitle>
          <DialogDescription>
            Check composition, copy and captions before export. Stills use your
            saved content and selected take; play the preview to check motion
            and sound.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={review.isPending || !pageScenes.length}
            onClick={() =>
              generate(
                pageScenes.map((scene) => scene.id),
                1,
              )
            }
          >
            {review.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Generate scene sheet
          </Button>
          <Button size="sm" variant="outline" disabled={review.isPending || !selectedSceneId}
            onClick={() => selectedSceneId && generate([selectedSceneId], 1, "scene", 1)}>
            Review and fix selected layout
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={review.isPending || !selectedSceneId}
            onClick={() => selectedSceneId && generate([selectedSceneId], 4)}
          >
            Four moments · selected scene
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={
              review.isPending ||
              !selectedSceneId ||
              scenes.findIndex((scene) => scene.id === selectedSceneId) < 1
            }
            onClick={() =>
              selectedSceneId && generate([selectedSceneId], 1, "transition")
            }
          >
            Cut into selected scene
          </Button>
          <Button
            size="sm"
            variant={phoneSize ? "secondary" : "outline"}
            aria-pressed={phoneSize}
            onClick={() => setPhoneSize((value) => !value)}
          >
            <Smartphone className="size-3.5" /> Phone size
          </Button>
        </div>
        {review.data?.review.repair && <p className="text-muted-foreground text-xs">
          {review.data.review.repair.repairedSceneIds.length} layout(s) repaired in at most one pass; {review.data.review.repair.unresolved} findings remain. No paid calls. Copy, assets and voice timing are preserved. Review the refreshed preview.
        </p>}
        {scenes.length > 8 && (
          <div className="flex items-center gap-2 text-xs">
            <Button
              size="sm"
              variant="ghost"
              disabled={safePage === 0 || review.isPending}
              onClick={() => changePage(safePage - 1)}
            >
              Previous
            </Button>
            <span>
              Sheet range: scenes {safePage * 8 + 1}–
              {Math.min(scenes.length, safePage * 8 + 8)}
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={(safePage + 1) * 8 >= scenes.length || review.isPending}
              onClick={() => changePage(safePage + 1)}
            >
              Next
            </Button>
          </div>
        )}
        {review.isPending && (
          <p role="status" className="text-muted-foreground text-sm">
            Capturing saved frames… First use may take longer while the engine
            prepares.
          </p>
        )}
        {review.isError && (
          <p role="alert" className="text-destructive text-sm">
            {review.error.message}
          </p>
        )}
        {stale && (
          <p role="status" className="text-muted-foreground text-sm">
            The video has changed. Generate a new review to see the current
            visuals.
          </p>
        )}
        {current && (
          <>
            <p className="text-muted-foreground text-xs">
              {current.takeUsable
                ? "Selected take timing"
                : "Estimated timing — generate a matching take for final timing"}
              {" · "}
              HyperFrames
              {" · Select a still to edit its scene"}
            </p>
            {current.findings?.length > 0 && (
              <section
                aria-label="Review suggestions"
                className="rounded-lg border p-3"
              >
                <p className="text-sm font-medium">Review suggestions</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Reading time is estimated. Layout warnings apply only to
                  measured reading frames; check playback and phone-size stills
                  for legibility.
                </p>
                <ul className="mt-2 space-y-2">
                  {current.findings.map((finding, index) => (
                    <li
                      key={`${finding.sceneId}-${finding.frame}-${finding.kind}-${index}`}
                    >
                      <button
                        type="button"
                        className="hover:text-primary focus-visible:outline-primary w-full text-left text-xs focus-visible:outline-2 focus-visible:outline-offset-2"
                        onClick={() => {
                          onSelectScene(finding.sceneId);
                          setOpen(false);
                        }}
                      >
                        <span className="font-medium">
                          Scene {finding.sceneNumber} ·{" "}
                          {(finding.frame / current.fps).toFixed(2)}s
                        </span>
                        {" — "}
                        {finding.message}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <p className="text-muted-foreground text-xs">
              {current.layoutReview?.status === "sampled"
                ? "Content text checked in sampled reading frames. Contrast warnings use conservative pixel samples. Captions, chrome and complex or animated text need visual review."
                : "Native layout measurements are unavailable for these frames. Check clipping and safe areas visually."}
            </p>
            {phoneSize && (
              <p className="text-muted-foreground text-xs">
                320 px wide, scaled down further only if your window is
                narrower.
              </p>
            )}
            <div
              className={
                phoneSize
                  ? "flex flex-wrap items-start justify-center gap-4"
                  : "grid grid-cols-2 items-start gap-4 sm:grid-cols-4"
              }
            >
              {current.stills.map((still) => (
                <button
                  key={`${still.sceneId}-${still.frame}`}
                  type="button"
                  className="group focus-visible:outline-primary mx-auto w-full max-w-full text-left focus-visible:outline-2 focus-visible:outline-offset-4"
                  style={phoneSize ? { width: 320 } : undefined}
                  onClick={() => {
                    onSelectScene(still.sceneId);
                    setOpen(false);
                  }}
                >
                  {/* Stored PNGs retain the native canvas; CSS only scales the review. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={still.url}
                    alt={`Scene ${still.sceneNumber}, ${still.label.toLowerCase()}, at ${(still.frame / current.fps).toFixed(2)} seconds`}
                    width={current.width}
                    height={current.height}
                    className="group-hover:ring-primary w-full rounded-lg border bg-black group-hover:ring-2"
                  />
                  <p className="mt-2 text-xs font-medium">
                    Scene {still.sceneNumber} · {still.label}
                  </p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {(still.frame / current.fps).toFixed(2)}s
                  </p>
                </button>
              ))}
            </div>
          </>
        )}
        {!review.data && !review.isPending && !review.isError && (
          <p className="text-muted-foreground py-8 text-center text-sm">
            Generate a scene sheet for up to eight scenes, or inspect four
            moments of the selected scene.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
