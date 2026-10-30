"use client";
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import type {
  EditorialScript,
  EditorialWorkflow,
} from "@/production/editorial";
import type { EvidencePack } from "@/research/contracts";
import { EvidenceReview } from "@/components/projects/evidence-review";
import { EditorialStoryboardPanel } from "./editorial-storyboard-panel";
import type { EditorialStoryboard } from "@/production/editorial-storyboard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function EditorialScriptPanel({
  scriptId,
  initial,
  evidence,
  storyboard,
}: {
  scriptId: string;
  initial: EditorialWorkflow;
  evidence?: EvidencePack;
  storyboard?: EditorialStoryboard;
}) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["editorial", scriptId],
    queryFn: () =>
      apiGet<{ workflow: EditorialWorkflow; storyboard?: EditorialStoryboard }>(
        `/api/scripts/${scriptId}/editorial`,
      ),
    initialData: { workflow: initial, storyboard },
    refetchInterval: (query) =>
      ["queued", "running"].includes(query.state.data?.workflow.state ?? "")
        ? 1000
        : false,
  });
  const [error, setError] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const workflow = query.data.workflow;
  async function action(input: unknown) {
    setPending(true);
    setError("");
    try {
      await apiPost(`/api/scripts/${scriptId}/editorial`, input);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["editorial", scriptId] }),
        client.invalidateQueries({ queryKey: ["script", scriptId] }),
      ]);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Editorial operation failed",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      className="bg-card space-y-3 rounded-xl border p-4"
      aria-label="Editorial script"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Review the script</h2>
        <span role="status">
          Writing: {workflow.state} ·{" "}
          {workflow.callsUsed + workflow.revisionCallsUsed}/
          {workflow.request.budget.maxProviderCalls} total calls
        </span>
      </div>
      <p className="text-muted-foreground text-sm">
        {workflow.request.creativeBrief.intent} ·{" "}
        {workflow.request.creativeBrief.audience} ·{" "}
        {workflow.request.creativeBrief.language} · target{" "}
        {workflow.request.creativeBrief.targetSeconds}s
      </p>
      <p className="text-sm">
        Goal: {workflow.request.creativeBrief.goal} · Takeaway:{" "}
        {workflow.request.creativeBrief.takeaway}
      </p>
      {workflow.error && <p role="alert">{workflow.error}</p>}
      {(error || query.error) && (
        <p role="alert">{error || query.error?.message}</p>
      )}
      {workflow.state === "queued" || workflow.state === "running" ? (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => void action({ action: "cancel" })}
        >
          Cancel writing
        </Button>
      ) : null}
      {["failed", "canceled"].includes(workflow.state) &&
        workflow.callsUsed === 0 && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => void action({ action: "resume" })}
          >
            Resume unspent writing
          </Button>
        )}
      {workflow.state === "ready" && workflow.draft && (
        <DraftEditor
          key={workflow.revision}
          draft={workflow.draft}
          pending={pending}
          onSave={(draft) =>
            void action({
              action: "save",
              expectedRevision: workflow.revision,
              draft,
            })
          }
        />
      )}
      {workflow.state === "ready" && workflow.draft && (
        <EditorialStoryboardPanel
          scriptId={scriptId}
          revision={workflow.revision}
          storyboard={query.data.storyboard}
        />
      )}
      {evidence && (
        <details>
          <summary className="cursor-pointer text-sm">Review evidence</summary>
          <EvidenceReview evidence={evidence} />
        </details>
      )}
    </section>
  );
}
function DraftEditor({
  draft: initial,
  pending,
  onSave,
}: {
  draft: EditorialScript;
  pending: boolean;
  onSave: (draft: EditorialScript) => void;
}) {
  const [draft, setDraft] = React.useState(initial);
  return (
    <fieldset disabled={pending} className="space-y-3">
      <p className="text-sm">
        Angle: {draft.angle} · Estimated narration{" "}
        {Math.round(draft.estimatedSeconds)}s
      </p>
      {draft.beats.map((beat, index) => (
        <div key={beat.id} className="space-y-2 rounded-lg border p-3">
          <label
            className="text-sm font-medium"
            htmlFor={`editorial-${beat.id}`}
          >
            {index + 1}. {beat.purpose}
          </label>
          <label
            className="block text-xs"
            htmlFor={`editorial-headline-${beat.id}`}
          >
            Screen copy
          </label>
          <Textarea
            id={`editorial-headline-${beat.id}`}
            value={beat.headline}
            maxLength={1000}
            disabled={initial.beats[index]?.locked}
            onChange={(event) =>
              setDraft({
                ...draft,
                beats: draft.beats.map((item) =>
                  item.id === beat.id
                    ? { ...item, headline: event.target.value }
                    : item,
                ),
              })
            }
          />
          <Textarea
            maxLength={4000}
            id={`editorial-${beat.id}`}
            rows={3}
            value={beat.narration}
            disabled={initial.beats[index]?.locked}
            onChange={(event) =>
              setDraft({
                ...draft,
                beats: draft.beats.map((item) =>
                  item.id === beat.id
                    ? { ...item, narration: event.target.value }
                    : item,
                ),
              })
            }
          />
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={beat.locked}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  beats: draft.beats.map((item) =>
                    item.id === beat.id
                      ? { ...item, locked: event.target.checked }
                      : item,
                  ),
                })
              }
            />
            Protect this writing beat (save to unlock before editing)
          </label>
          <p className="text-muted-foreground text-xs">
            {beat.references.length} source references · citations show
            provenance, not guaranteed truth
          </p>
        </div>
      ))}
      {draft.gaps.map((gap, index) => (
        <p key={index} className="text-muted-foreground text-sm">
          Review: {gap}
        </p>
      ))}
      <Button type="button" onClick={() => onSave(draft)}>
        Save editorial script
      </Button>
    </fieldset>
  );
}
