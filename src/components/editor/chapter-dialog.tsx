"use client";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api-client";
import type { ScriptDTO } from "@/lib/dto";
import type { ReelBeat } from "@/video/types";
import {
  chapterPlanIssue,
  resolveChapters,
  type ChapterPlan,
  type ChapterEdit,
} from "@/production/chapters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TopicChapterDraft } from "@/components/editor/topic-chapter-draft";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function ChapterDialog({
  script,
  timeline,
  fps,
  takeId,
  selectedSceneId,
  onSelectScene,
}: {
  script: ScriptDTO;
  timeline: ReelBeat[];
  fps: number;
  takeId?: string | null;
  selectedSceneId?: string;
  onSelectScene: (sceneId: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Chapters
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Chapter structure</DialogTitle>
            <DialogDescription>
              Name storyboard sections and choose where they begin. Suggestions
              use the selected take&apos;s timing when available. Exports
              currently support up to 5 minutes with a valid saved chapter plan
              at 24, 30, or 60 fps. Other storyboards support up to 3 minutes.
            </DialogDescription>
          </DialogHeader>
          {open && (
            <div>
              <ChapterForm
                script={script}
                timeline={timeline}
                fps={fps}
                takeId={takeId}
                selectedSceneId={selectedSceneId}
                onSelectScene={(id) => {
                  onSelectScene(id);
                  setOpen(false);
                }}
              />
              <TopicChapterDraft script={script} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ChapterForm({
  script,
  timeline,
  fps,
  takeId,
  selectedSceneId,
  onSelectScene,
}: {
  script: ScriptDTO;
  timeline: ReelBeat[];
  fps: number;
  takeId?: string | null;
  selectedSceneId?: string;
  onSelectScene: (sceneId: string) => void;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = React.useState<ChapterPlan | null>(
    script.chapterPlan ?? null,
  );
  const [expected, setExpected] = React.useState<ChapterPlan | null>(
    script.chapterPlan ?? null,
  );
  const [sceneIds, setSceneIds] = React.useState(
    script.scenes.map((scene) => scene.id),
  );
  const [timingSource, setTimingSource] = React.useState<string>();
  const suggest = useMutation({
    mutationFn: () =>
      apiPost<{
        proposal: ChapterPlan;
        expected: ChapterPlan | null;
        expectedSceneIds: string[];
        timingSource: string;
      }>(`/api/scripts/${script.id}/chapters`, {
        ...(takeId ? { takeId } : {}),
      }),
    onSuccess: (data) => {
      setDraft(data.proposal);
      setExpected(data.expected);
      setSceneIds(data.expectedSceneIds);
      setTimingSource(data.timingSource);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["script", script.id] }),
  });
  const save = useMutation({
    mutationFn: async (input: ChapterEdit) => {
      const response = await fetch(`/api/scripts/${script.id}/chapters`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await response.json()) as {
        script: ScriptDTO;
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error ?? "Chapter plan could not be saved.");
      return data.script;
    },
    onSuccess: (updated) => {
      qc.setQueryData(["script", script.id], updated);
      setExpected(updated.chapterPlan ?? null);
      setDraft(updated.chapterPlan ?? null);
      setSceneIds(updated.scenes.map((scene) => scene.id));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["script", script.id] }),
  });
  const stale =
    JSON.stringify(sceneIds) !==
      JSON.stringify(script.scenes.map((scene) => scene.id)) ||
    JSON.stringify(expected) !== JSON.stringify(script.chapterPlan ?? null);
  const issue = draft ? chapterPlanIssue(draft, sceneIds) : undefined;
  const sections =
    draft && !issue && !stale
      ? resolveChapters(draft, sceneIds, timeline).chapters
      : [];
  const busy = suggest.isPending || save.isPending;
  const canAdd =
    selectedSceneId &&
    sceneIds.includes(selectedSceneId) &&
    (!draft || draft.chapters.length < 12) &&
    selectedSceneId !== sceneIds[0] &&
    !draft?.chapters.some(
      (chapter) => chapter.firstSceneId === selectedSceneId,
    );
  function reload() {
    setDraft(script.chapterPlan ?? null);
    setExpected(script.chapterPlan ?? null);
    setSceneIds(script.scenes.map((scene) => scene.id));
    save.reset();
  }
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => suggest.mutate()}
        >
          {suggest.isPending ? "Planning…" : "Suggest chapters"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || stale || !canAdd}
          onClick={() => {
            const base: ChapterPlan = draft ?? {
              version: "1.0.0",
              chapters: [
                {
                  id: "chapter:1",
                  title: "Chapter 1",
                  firstSceneId: sceneIds[0],
                },
              ],
            };
            setDraft({
              ...base,
              chapters: [
                ...base.chapters,
                {
                  id: `chapter:${crypto.randomUUID()}`,
                  title: `Chapter ${base.chapters.length + 1}`,
                  firstSceneId: selectedSceneId!,
                },
              ].sort(
                (a, b) =>
                  sceneIds.indexOf(a.firstSceneId) -
                  sceneIds.indexOf(b.firstSceneId),
              ),
            });
          }}
        >
          Start chapter at selected scene
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Suggestions are drafts until saved. Each chapter contains up to 20
        scenes. Chapter titles organize the storyboard.
      </p>
      {timingSource && (
        <p className="text-muted-foreground text-xs">
          Suggested using{" "}
          {timingSource === "voice-take"
            ? "matching voice timing"
            : "estimated timing"}
          .
        </p>
      )}
      {stale && (
        <div className="grid gap-2">
          <p role="alert" className="text-destructive text-xs">
            Scenes or saved chapters changed. Reload before editing this
            outline.
          </p>
          <Button size="sm" variant="outline" onClick={reload}>
            Reload chapter plan
          </Button>
        </div>
      )}
      {draft?.chapters.map((chapter, index) => {
        const section = sections.find((section) => section.id === chapter.id);
        return (
          <div key={chapter.id} className="grid gap-2 rounded-lg border p-3">
            <Label className="grid gap-1 text-xs">
              Storyboard chapter title
              <Input
                aria-label={`Chapter ${index + 1} title`}
                value={chapter.title}
                maxLength={120}
                disabled={busy || stale}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    chapters: draft.chapters.map((item) =>
                      item.id === chapter.id
                        ? { ...item, title: event.target.value }
                        : item,
                    ),
                  })
                }
              />
            </Label>
            <Label className="grid gap-1 text-xs">
              Starts at scene
              <select
                aria-label={`Chapter ${index + 1} first scene`}
                className="bg-background rounded-md border px-2 py-1.5"
                disabled={busy || stale || index === 0}
                value={chapter.firstSceneId}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    chapters: draft.chapters
                      .map((item) =>
                        item.id === chapter.id
                          ? { ...item, firstSceneId: event.target.value }
                          : item,
                      )
                      .sort(
                        (a, b) =>
                          sceneIds.indexOf(a.firstSceneId) -
                          sceneIds.indexOf(b.firstSceneId),
                      ),
                  })
                }
              >
                {script.scenes
                  .filter(
                    (scene) =>
                      scene.id === chapter.firstSceneId ||
                      !draft.chapters.some(
                        (item) => item.firstSceneId === scene.id,
                      ),
                  )
                  .map((scene) => (
                    <option key={scene.id} value={scene.id}>
                      {scene.order + 1}. {scene.text.slice(0, 70)}
                    </option>
                  ))}
              </select>
            </Label>
            {section && (
              <p className="text-muted-foreground text-xs">
                {section.sceneIds.length} scenes ·{" "}
                {(section.startFrame / fps).toFixed(1)}–
                {(section.endFrame / fps).toFixed(1)}s before any cover
              </p>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy || stale || !section}
                onClick={() => onSelectScene(chapter.firstSceneId)}
              >
                Go to chapter
              </Button>
              {index > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy || stale}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      chapters: draft.chapters.filter(
                        (item) => item.id !== chapter.id,
                      ),
                    })
                  }
                >
                  Merge with previous
                </Button>
              )}
            </div>
          </div>
        );
      })}
      {(issue || suggest.isError || save.isError) && (
        <p role="alert" className="text-destructive text-xs">
          {issue ??
            (suggest.isError ? suggest.error.message : save.error?.message)}
        </p>
      )}
      <Button
        size="sm"
        disabled={
          busy ||
          stale ||
          !draft ||
          Boolean(issue) ||
          draft.chapters.some((chapter) => !chapter.title.trim())
        }
        onClick={() =>
          draft &&
          save.mutate({ expected, expectedSceneIds: sceneIds, plan: draft })
        }
      >
        {save.isPending ? "Saving…" : "Save chapter plan"}
      </Button>
    </div>
  );
}
