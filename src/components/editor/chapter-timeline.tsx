"use client";
import type { ComponentProps } from "react";
import {
  chapterPlanIssue,
  resolveChapters,
  type ChapterPlan,
} from "@/production/chapters";
import { SceneTimeline } from "./scene-timeline";
import { Button } from "@/components/ui/button";

type Props = ComponentProps<typeof SceneTimeline> & { plan?: ChapterPlan };
export function ChapterTimeline({ plan, ...props }: Props) {
  if (
    !plan ||
    chapterPlanIssue(
      plan,
      props.scenes.map((scene) => scene.id),
    )
  )
    return <SceneTimeline {...props} />;
  const { chapters } = resolveChapters(
    plan,
    props.scenes.map((scene) => scene.id),
    props.timeline,
  );
  const duration =
    Math.max(
      0,
      ...props.timeline.map((beat) => beat.startFrame + beat.durationFrames),
    ) / props.fps;
  return (
    <section
      aria-label="Chapter timeline"
      className="bg-card space-y-3 rounded-xl border p-3"
    >
      <div className="flex flex-wrap justify-between gap-2">
        <h3 className="text-sm font-semibold">Chapters · {chapters.length}</h3>
        <p className="text-muted-foreground text-xs">
          {props.measured ? "Narration timing" : "Estimated timing"} ·{" "}
          {(duration / 60).toFixed(1)} min
          {plan.longForm
            ? ` · Target ${(plan.longForm.targetSeconds / 60).toFixed(1)} min`
            : ""}
        </p>
      </div>
      <nav
        aria-label="Chapter overview"
        className="bg-card sticky top-16 z-10 flex flex-wrap gap-2 rounded-lg py-2"
      >
        {chapters.map((chapter, index) => (
          <Button
            key={chapter.id}
            variant="outline"
            size="sm"
            onClick={() => props.onSelect(chapter.firstSceneId)}
            aria-current={
              chapter.sceneIds.includes(props.selectedId ?? "")
                ? "step"
                : undefined
            }
          >
            {index + 1}. {chapter.title}
          </Button>
        ))}
      </nav>
      {chapters.map((chapter) => (
        <details
          key={chapter.id}
          open={
            chapter.sceneIds.includes(props.selectedId ?? "") ? true : undefined
          }
          className="rounded-lg border p-2"
        >
          <summary className="cursor-pointer text-sm font-medium">
            {chapter.title} · {chapter.sceneIds.length} scenes ·{" "}
            {(chapter.startFrame / props.fps).toFixed(0)}–
            {(chapter.endFrame / props.fps).toFixed(0)}s
          </summary>
          {chapter.direction && (
            <p className="text-muted-foreground my-2 text-xs">
              {chapter.direction.phase} · {chapter.direction.goal}
              {chapter.direction.callbackChapterId
                ? ` · Returns to ${chapters.find((prior) => prior.id === chapter.direction?.callbackChapterId)?.title}`
                : ""}
            </p>
          )}
          <SceneTimeline
            {...props}
            sceneOffset={props.scenes.findIndex(
              (scene) => scene.id === chapter.firstSceneId,
            )}
            scenes={props.scenes.filter((scene) =>
              chapter.sceneIds.includes(scene.id),
            )}
          />
        </details>
      ))}
    </section>
  );
}
