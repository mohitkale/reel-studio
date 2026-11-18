"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAIProviders } from "@/hooks/ai";
import { useReviewFields } from "@/hooks/ui-mode";
import { apiGet, apiPost } from "@/lib/api-client";
import { diffStoryboards, type StoryboardLike } from "@/lib/storyboard-diff";
import { estimateDurationSeconds, type Storyboard } from "@/storyboard";

type Doc = StoryboardLike & { format?: string; [k: string]: unknown };

/**
 * "Tell me what to change": the storyboard writer applies a plain-language
 * instruction to the current storyboard. The result is shown as a list of
 * changes to accept; nothing is made until it is. Needs a configured writer.
 */
export function TellMe({
  jobId,
  scriptId,
  quality,
}: {
  jobId: string;
  scriptId: string;
  quality?: "draft" | "standard" | "high";
}) {
  const router = useRouter();
  const providers = useAIProviders();
  const review = useReviewFields();
  const writer = providers.data?.find((p) => p.configured);
  const [instruction, setInstruction] = React.useState("");
  const [busy, setBusy] = React.useState<"asking" | "making">();
  const [error, setError] = React.useState<string>();
  const [proposal, setProposal] = React.useState<{
    before: Doc;
    after: Doc;
  }>();

  if (providers.isLoading) return null;
  if (!writer)
    return (
      <section aria-labelledby="tell-title" className="space-y-1">
        <h2 id="tell-title" className="text-lg font-semibold">
          Tell me what to change
        </h2>
        <p className="text-muted-foreground text-sm">
          This needs a storyboard writer. Add a key or a local model in
          Settings, or edit the text above by hand.
        </p>
      </section>
    );

  async function ask() {
    if (!writer || !instruction.trim()) return;
    setBusy("asking");
    setError(undefined);
    setProposal(undefined);
    try {
      const { storyboard: before } = await apiGet<{ storyboard: Doc }>(
        `/api/scripts/${scriptId}/storyboard`,
      );
      const seconds = Math.round(
        estimateDurationSeconds(before as unknown as Storyboard),
      );
      const written = await apiPost<{
        storyboard?: Doc;
        errors?: Array<{ path: string; message: string }>;
      }>("/api/storyboards/write", {
        providerId: writer.id,
        brief: {
          topic: "Revise an existing video",
          targetSeconds: Math.max(seconds, 5),
          format: before.format,
          revise: { storyboard: before, instruction: instruction.trim() },
        },
        fromSourceText: true,
        research: "off",
      });
      if (!written.storyboard)
        throw new Error(
          written.errors?.map((e) => `${e.path}: ${e.message}`).join("; ") ||
            "The writer did not return a storyboard. Try again.",
        );
      setProposal({ before, after: written.storyboard });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(undefined);
    }
  }

  async function accept() {
    if (!proposal) return;
    setBusy("making");
    setError(undefined);
    try {
      const queued = await apiPost<{ jobId?: string | null }>(
        "/api/storyboards",
        {
          storyboard: proposal.after,
          quality: quality ?? "standard",
          ...review,
        },
      );
      if (!queued.jobId) throw new Error("The studio did not start a video");
      router.push(`/results/${queued.jobId}?from=${encodeURIComponent(jobId)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(undefined);
    }
  }

  const diff = proposal && diffStoryboards(proposal.before, proposal.after);
  const none = diff && !diff.title && diff.scenes.length === 0;

  return (
    <section aria-labelledby="tell-title" className="space-y-3">
      <h2 id="tell-title" className="text-lg font-semibold">
        Tell me what to change
      </h2>
      <div className="flex flex-wrap gap-2">
        <label htmlFor="tell-me-input" className="sr-only">
          What should change in this video
        </label>
        <input
          id="tell-me-input"
          value={instruction}
          maxLength={500}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void ask();
          }}
          placeholder="For example: make the opening shorter and add a closing call to action"
          className="bg-background min-w-64 flex-1 rounded-lg border p-2 text-sm"
        />
        <Button
          variant="outline"
          disabled={busy !== undefined || !instruction.trim()}
          onClick={() => void ask()}
        >
          {busy === "asking" && (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          )}
          Show me the changes
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {diff && (
        <div className="space-y-2 rounded-lg border p-3 text-sm">
          {none && (
            <p>The writer made no changes. Try saying it differently.</p>
          )}
          {diff.title && (
            <p>
              Title: <del>{diff.title.before}</del> →{" "}
              <ins>{diff.title.after}</ins>
            </p>
          )}
          <ul className="space-y-1" aria-label="Changes">
            {diff.scenes.map((change, i) => (
              <li key={i}>
                Scene {change.index + 1}{" "}
                {change.kind === "added" && (
                  <>
                    added: <ins>{change.after}</ins>
                  </>
                )}
                {change.kind === "removed" && (
                  <>
                    removed: <del>{change.before}</del>
                  </>
                )}
                {change.kind === "changed" && (
                  <>
                    {change.field}: <del>{change.before}</del> →{" "}
                    <ins>{change.after}</ins>
                  </>
                )}
              </li>
            ))}
          </ul>
          {!none && (
            <div className="flex gap-2">
              <Button
                disabled={busy !== undefined}
                onClick={() => void accept()}
              >
                {busy === "making" && (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                )}
                Make this version
              </Button>
              <Button variant="outline" onClick={() => setProposal(undefined)}>
                Discard
              </Button>
            </div>
          )}
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        Only the storyboard text is written by the AI. The new version is a
        separate video; this one stays.
      </p>
    </section>
  );
}
