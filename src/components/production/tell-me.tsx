"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAIProviders } from "@/hooks/ai";
import { useUpdateScene } from "@/hooks/script";
import { useReviewFields } from "@/hooks/ui-mode";
import { apiGet, apiPost } from "@/lib/api-client";
import { diffStoryboards, type StoryboardLike } from "@/lib/storyboard-diff";
import type { SceneDTO, ScriptDTO } from "@/lib/dto";
import { pickWriter } from "@/lib/writer-chain";
import { estimateDurationSeconds, type Storyboard } from "@/storyboard";
import { ChangeVideo } from "./change-video";

type Doc = StoryboardLike & { format?: string; [k: string]: unknown };
type SceneCopy = Pick<SceneDTO, "id" | "text" | "spokenText">;

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
  const updateScene = useUpdateScene(scriptId);
  const writer = pickWriter(providers.data);
  const [instruction, setInstruction] = React.useState("");
  const [busy, setBusy] = React.useState<"asking" | "making">();
  const [error, setError] = React.useState<string>();
  const [proposal, setProposal] = React.useState<{
    before: Doc;
    after: Doc;
    copy?: { source: SceneCopy; text: string; spokenText: string };
  }>();
  const proposalSection = React.useRef<HTMLElement>(null);

  async function ask(request: {
    text: string;
    scene?: { source: SceneCopy; index: number };
    length?: number;
  }) {
    if (!writer || busy || !request.text.trim()) return;
    setBusy("asking");
    setError(undefined);
    setProposal(undefined);
    if (request.scene !== undefined) {
      proposalSection.current?.focus({ preventScroll: true });
      proposalSection.current?.scrollIntoView({ block: "nearest" });
    }
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
          targetSeconds: Math.min(
            600,
            Math.max(5, Math.round(seconds * (request.length ?? 1))),
          ),
          format: before.format,
          revise: { storyboard: before, instruction: request.text.trim() },
        },
        fromSourceText: true,
        research: "off",
      });
      if (!written.storyboard)
        throw new Error(
          written.errors?.map((e) => `${e.path}: ${e.message}`).join("; ") ||
            "The writer did not return a storyboard. Try again.",
        );
      if (!request.scene) {
        setProposal({ before, after: written.storyboard });
      } else {
        const { index, source } = request.scene;
        const previous = before.scenes;
        const generated = written.storyboard.scenes;
        const original = previous?.[index];
        const revised = generated?.[index];
        const { headline, narration } = revised ?? {};
        if (
          !previous ||
          !original ||
          typeof headline !== "string" ||
          !headline.trim() ||
          typeof narration !== "string" ||
          !narration.trim() ||
          generated?.length !== previous.length
        )
          throw new Error(
            "The writer changed the scene count. Try regenerating the scene again.",
          );
        // Limit the response to the requested copy. Retain the original scene
        // type, media, data and position even if the writer changes them.
        const text =
          typeof original.headline === "string" &&
          original.headline &&
          source.text.startsWith(original.headline)
            ? headline + source.text.slice(original.headline.length)
            : headline;
        setProposal({
          before,
          after: {
            ...before,
            scenes: previous.map((scene, position) =>
              position === index
                ? {
                    ...scene,
                    headline,
                    narration,
                  }
                : scene,
            ),
          },
          copy: { source, text, spokenText: narration },
        });
      }
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
      if (proposal.copy) {
        const { source, text, spokenText } = proposal.copy;
        const { script } = await apiGet<{ script: ScriptDTO }>(
          `/api/scripts/${scriptId}`,
        );
        const scene = script.scenes.find((item) => item.id === source.id);
        if (!scene || scene.locks?.scene || scene.locks?.copy)
          throw new Error(
            "This scene is no longer available for regeneration.",
          );
        if (scene.text !== text || scene.spokenText !== spokenText) {
          if (
            scene.text !== source.text ||
            scene.spokenText !== source.spokenText
          )
            throw new Error(
              "This scene changed while the proposal was open. Regenerate its copy again.",
            );
          await updateScene.mutateAsync({ id: scene.id, text, spokenText });
        }
        const { job } = await apiPost<{ job: { id: string } }>(
          `/api/production-jobs/${jobId}/produce-current`,
          review,
        );
        router.push(`/results/${job.id}?from=${encodeURIComponent(jobId)}`);
        return;
      }
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
    <div className="min-w-0 space-y-5">
      <ChangeVideo
        jobId={jobId}
        scriptId={scriptId}
        proposing={busy !== undefined}
        onRegenerate={
          writer
            ? (scene, index) =>
                void ask({
                  scene: { source: scene, index },
                  text: `Rewrite the headline and narration for scene ${index + 1} only. Keep the topic and factual details, the number and order of scenes, and all other storyboard fields.`,
                })
            : undefined
        }
      />
      <section
        aria-labelledby="tell-title"
        ref={proposalSection}
        tabIndex={-1}
        className="space-y-3 focus:outline-none"
      >
        <h2 id="tell-title" className="text-lg font-semibold">
          Tell me what to change
        </h2>
        {!writer && !providers.isLoading && (
          <p className="text-muted-foreground text-sm">
            Add a storyboard writer in Settings to regenerate copy or change the
            length.
          </p>
        )}
        {writer && (
          <>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={busy !== undefined}
                onClick={() =>
                  void ask({
                    length: 0.75,
                    text: "Make the video about 25% shorter. Remove repetition and preserve the main facts and the call to action.",
                  })
                }
              >
                Shorter
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy !== undefined}
                onClick={() =>
                  void ask({
                    length: 1.25,
                    text: "Make the video about 25% longer. Explain the main ideas in more depth using only facts in the existing storyboard.",
                  })
                }
              >
                Longer
              </Button>
            </div>
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
                  if (e.key === "Enter") void ask({ text: instruction });
                }}
                placeholder="For example: make the opening shorter and add a closing call to action"
                className="bg-background min-w-64 flex-1 rounded-lg border p-2 text-sm"
              />
              <Button
                variant="outline"
                disabled={busy !== undefined || !instruction.trim()}
                onClick={() => void ask({ text: instruction })}
              >
                {busy === "asking" && (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                )}
                Show me the changes
              </Button>
            </div>
            {busy === "asking" && (
              <p role="status" className="text-sm">
                Preparing storyboard changes…
              </p>
            )}
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
                    <Button
                      variant="outline"
                      onClick={() => setProposal(undefined)}
                    >
                      Discard
                    </Button>
                  </div>
                )}
              </div>
            )}
            <p className="text-muted-foreground text-xs">
              The writer changes storyboard text. You can reopen the previous
              render after making a new version.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
