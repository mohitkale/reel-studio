"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api-client";
import type {
  EditorialStoryboard,
  StoryboardControl,
} from "@/production/editorial-storyboard";
import { Button } from "@/components/ui/button";
export function EditorialStoryboardPanel({
  scriptId,
  revision,
  storyboard,
}: {
  scriptId: string;
  revision: number;
  storyboard?: EditorialStoryboard;
}) {
  const client = useQueryClient();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function action(input: StoryboardControl) {
    setPending(true);
    setError("");
    try {
      await apiPost(`/api/scripts/${scriptId}/editorial/storyboard`, input);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["editorial", scriptId] }),
        client.invalidateQueries({ queryKey: ["script", scriptId] }),
      ]);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Storyboard operation failed",
      );
    } finally {
      setPending(false);
    }
  }
  const current = storyboard?.sourceRevision === revision;
  return (
    <section
      className="space-y-3 border-t pt-3"
      aria-label="Editorial storyboard"
    >
      <h3 className="font-semibold">Compile the approved script</h3>
      <p className="text-muted-foreground text-sm">
        Writing: at most one writer call. Storyboard: zero provider calls.
        Visual revisions reuse writing and research. Compilation preserves
        narration and uses local directors; it never generates product UI or
        proof.
      </p>
      {error && <p role="alert">{error}</p>}
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          void action({
            action: "compile",
            expectedRevision: revision,
            budget: { maxProviderCalls: 0 },
          })
        }
      >
        {storyboard?.state === "canceled"
          ? "Resume local compilation"
          : "Preview storyboard"}
      </Button>
      {storyboard && !current && (
        <p role="status">
          Writing changed. Compile this revision before applying.
        </p>
      )}
      {current && storyboard && (
        <>
          <p role="status">
            Storyboard {storyboard.state} · saved writing revision{" "}
            {storyboard.sourceRevision} · {storyboard.providerCalls} provider
            calls
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {storyboard.shots.map((shot, index) => (
              <article
                key={shot.beatId}
                className="space-y-1 rounded-lg border p-3 text-sm"
              >
                <h4 className="font-medium">
                  {index + 1}. {shot.purpose}
                </h4>
                <p>Screen: {shot.screenCopy}</p>
                <p>Narration: {shot.narration}</p>
                <p className="text-muted-foreground">
                  {storyboard.plan.scenes[index]?.templateId} ·{" "}
                  {shot.explanation}
                </p>
                {shot.assetNeeds.map((need) => (
                  <p key={need}>Asset need: {need}</p>
                ))}
              </article>
            ))}
          </div>
          {storyboard.state === "ready" && (
            <div className="flex gap-2">
              <Button
                disabled={pending}
                onClick={() =>
                  void action({
                    action: "apply",
                    expectedHash: storyboard.sourceHash,
                  })
                }
              >
                Apply reviewed storyboard
              </Button>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  void action({
                    action: "cancel",
                    expectedHash: storyboard.sourceHash,
                  })
                }
              >
                Cancel storyboard
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
