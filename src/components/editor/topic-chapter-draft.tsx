"use client";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost, apiPatch } from "@/lib/api-client";
import type { ScriptDTO } from "@/lib/dto";
import { useAIProviders } from "@/hooks/ai";
import type { AIProviderId } from "@/providers/ai/types";
import {
  chapterDraftSchema,
  chapterDraftCapacityIssue,
  type ChapterDraft,
} from "@/production/chapter-draft";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Result = { draft: ChapterDraft | null; script: ScriptDTO };
export function TopicChapterDraft({
  script,
}: {
  script: Pick<ScriptDTO, "id" | "scenes" | "chapterPlan" | "chapterDraft">;
}) {
  const qc = useQueryClient();
  const { data: providers } = useAIProviders();
  const configured = (providers ?? []).filter(
    (provider) => provider.configured,
  );
  const [providerId, setProviderId] = React.useState<AIProviderId>();
  const provider = providerId ?? configured[0]?.id;
  const [topic, setTopic] = React.useState(script.chapterDraft?.topic ?? "");
  const [chapterCount, setChapterCount] = React.useState(2);
  const [scenesPerChapter, setScenesPerChapter] = React.useState(4);
  const [draft, setDraft] = React.useState<ChapterDraft | null>(
    script.chapterDraft ?? null,
  );
  const [expected, setExpected] = React.useState<ChapterDraft | null>(
    script.chapterDraft ?? null,
  );
  function saved(result: Result) {
    setDraft(result.draft);
    setExpected(result.draft);
    qc.setQueryData(["script", script.id], result.script);
  }
  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["script", script.id] });
  const generate = useMutation({
    retry: false,
    mutationFn: () =>
      apiPost<Result>(`/api/scripts/${script.id}/chapter-draft`, {
        providerId: provider,
        topic,
        chapterCount,
        scenesPerChapter,
      }),
    onSuccess: saved,
    onSettled: refresh,
  });
  const save = useMutation({
    retry: false,
    mutationFn: () =>
      apiPatch<Result>(`/api/scripts/${script.id}/chapter-draft`, {
        expected,
        draft,
      }),
    onSuccess: saved,
    onSettled: refresh,
  });
  const stale =
    JSON.stringify(expected) !== JSON.stringify(script.chapterDraft ?? null);
  const busy = generate.isPending || save.isPending;
  const requestIssue = chapterDraftCapacityIssue(
    script,
    Array.from(
      { length: Math.max(0, Math.min(12, chapterCount)) },
      () => scenesPerChapter,
    ),
  );
  const validDraft = !draft || chapterDraftSchema.safeParse(draft).success;
  const draftIssue = draft
    ? chapterDraftCapacityIssue(
        script,
        draft.chapters.map((chapter) => chapter.sceneCount),
      )
    : undefined;
  function edit(
    index: number,
    change: Partial<ChapterDraft["chapters"][number]>,
  ) {
    setDraft((current) =>
      current
        ? {
            ...current,
            chapters: current.chapters.map((chapter, position) =>
              position === index ? { ...chapter, ...change } : chapter,
            ),
          }
        : null,
    );
  }
  return (
    <details
      className="mt-4 rounded-lg border p-3"
      open={script.chapterDraft ? true : undefined}
    >
      <summary className="cursor-pointer text-sm font-medium">
        Plan next chapters from a topic
      </summary>
      <div className="mt-3 grid gap-3">
        <p className="text-muted-foreground text-xs">
          Generate and save writing briefs in one AI request. Scenes and saved
          chapter boundaries stay unchanged. Review the facts and edit the
          briefs before using Add scenes.
        </p>
        <div className="grid gap-2">
          <Label htmlFor="chapter-topic">Topic and supplied facts</Label>
          <Textarea
            id="chapter-topic"
            rows={3}
            maxLength={4000}
            value={topic}
            disabled={busy}
            onChange={(event) => setTopic(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="grid gap-1">
            <Label htmlFor="chapter-draft-provider">Provider</Label>
            <select
              id="chapter-draft-provider"
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
              value={provider ?? ""}
              disabled={busy}
              onChange={(event) =>
                setProviderId(event.target.value as AIProviderId)
              }
            >
              {!configured.length && (
                <option value="">Configure in Settings</option>
              )}
              {configured.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="chapter-draft-count">New chapters</Label>
            <Input
              id="chapter-draft-count"
              type="number"
              min={1}
              max={12}
              value={chapterCount}
              disabled={busy}
              onChange={(event) => setChapterCount(Number(event.target.value))}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="chapter-draft-scenes">Scenes per chapter</Label>
            <Input
              id="chapter-draft-scenes"
              type="number"
              min={1}
              max={20}
              value={scenesPerChapter}
              disabled={busy}
              onChange={(event) =>
                setScenesPerChapter(Number(event.target.value))
              }
            />
          </div>
        </div>
        {requestIssue && (
          <p role="alert" className="text-destructive text-xs">
            {requestIssue}
          </p>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={
            busy ||
            stale ||
            !provider ||
            topic.trim().length < 3 ||
            chapterCount < 1 ||
            chapterCount > 12 ||
            !Number.isInteger(chapterCount) ||
            Boolean(requestIssue)
          }
          onClick={() => generate.mutate()}
        >
          {generate.isPending
            ? "Planning…"
            : draft
              ? "Generate a new writing draft"
              : "Generate writing draft"}
        </Button>
        {draft && (
          <div className="grid gap-3">
            <p className="text-muted-foreground text-xs">
              Saved topic: {draft.topic}.{" "}
              {draft.chapters.reduce(
                (sum, chapter) => sum + chapter.sceneCount,
                0,
              )}{" "}
              planned scenes. This draft does not reserve production time;
              export timing is checked after scenes and narration are prepared.
            </p>
            {draft.chapters.map((chapter, index) => (
              <div
                key={chapter.id}
                className="grid gap-2 rounded-lg border p-3"
              >
                <Label htmlFor={`chapter-draft-title-${index}`}>
                  Chapter {index + 1} title
                </Label>
                <Input
                  id={`chapter-draft-title-${index}`}
                  value={chapter.title}
                  maxLength={120}
                  disabled={busy}
                  onChange={(event) =>
                    edit(index, { title: event.target.value })
                  }
                />
                <Label htmlFor={`chapter-draft-brief-${index}`}>
                  Writing brief
                </Label>
                <Textarea
                  id={`chapter-draft-brief-${index}`}
                  rows={3}
                  maxLength={2000}
                  value={chapter.brief}
                  disabled={busy}
                  onChange={(event) =>
                    edit(index, { brief: event.target.value })
                  }
                />
                <Label htmlFor={`chapter-draft-scene-count-${index}`}>
                  Planned scenes
                </Label>
                <Input
                  id={`chapter-draft-scene-count-${index}`}
                  type="number"
                  min={1}
                  max={20}
                  value={chapter.sceneCount}
                  disabled={busy}
                  onChange={(event) =>
                    edit(index, { sceneCount: Number(event.target.value) })
                  }
                />
              </div>
            ))}
            {(!validDraft || draftIssue) && (
              <p role="alert" className="text-destructive text-xs">
                {draftIssue ??
                  "Use a title, a writing brief of at least 3 characters, and 1–20 scenes for every chapter."}
              </p>
            )}
            <Button
              size="sm"
              disabled={
                busy ||
                stale ||
                !validDraft ||
                Boolean(draftIssue) ||
                JSON.stringify(expected) === JSON.stringify(draft)
              }
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Saving…" : "Save writing draft"}
            </Button>
          </div>
        )}
        {stale && (
          <div className="grid gap-2">
            <p role="alert" className="text-destructive text-xs">
              The saved draft changed. Reload before saving.
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setDraft(script.chapterDraft ?? null);
                setExpected(script.chapterDraft ?? null);
                generate.reset();
                save.reset();
              }}
            >
              Reload writing draft
            </Button>
          </div>
        )}
        {(generate.error || save.error) && (
          <p role="alert" className="text-destructive text-xs">
            {(generate.error ?? save.error)?.message}
          </p>
        )}
      </div>
    </details>
  );
}
