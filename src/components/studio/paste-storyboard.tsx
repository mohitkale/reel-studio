"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClipboardCopy, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useReviewFields } from "@/hooks/ui-mode";
import { apiPost } from "@/lib/api-client";
import { finishStoryboard } from "@/lib/one-prompt";
import { buildFixRequest, checkPasted } from "@/lib/paste-storyboard";

/**
 * No API key needed: copy the prompt into any chat assistant, paste its reply
 * back, and the storyboard is checked here. Two copy-pastes from topic to video.
 */
export function PasteStoryboard({
  topic,
  format,
  seconds,
  theme,
  narration,
  music = true,
  captions = true,
  draft = false,
}: {
  topic: string;
  format: string;
  seconds: number;
  theme: string;
  narration: boolean;
  music?: boolean;
  captions?: boolean;
  /** Make a lower-quality, faster draft. */
  draft?: boolean;
}) {
  const router = useRouter();
  const review = useReviewFields();
  const [reply, setReply] = React.useState("");
  const [copied, setCopied] = React.useState<string>();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [promptText, setPromptText] = React.useState<string>();

  const result = React.useMemo(
    () => (reply.trim() ? checkPasted(reply) : null),
    [reply],
  );
  const errors = result?.lint?.errors ?? [];
  const valid = Boolean(result?.lint?.storyboard) && errors.length === 0;

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      // The text is shown below so it can be copied by hand.
      setPromptText(text);
    }
  }

  async function copyPrompt() {
    setError(undefined);
    try {
      const { prompt } = await apiPost<{ prompt: string }>(
        "/api/storyboards/prompt",
        {
          topic: topic.trim() || "(describe your video here)",
          targetSeconds: seconds,
          format,
        },
      );
      await copy(prompt, "prompt");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build the prompt");
    }
  }

  async function make() {
    if (!result?.lint?.storyboard) return;
    setBusy(true);
    setError(undefined);
    try {
      const queued = await apiPost<{ jobId?: string | null }>(
        "/api/storyboards",
        {
          storyboard: finishStoryboard(
            result.lint.storyboard as unknown as Record<string, unknown>,
            { theme, narration, music, captions },
          ),
          quality: draft ? "draft" : "standard",
          ...review,
        },
      );
      if (!queued.jobId) throw new Error("The studio did not start a video");
      router.push(`/results/${queued.jobId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  async function onDrop(event: React.DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) setReply(await file.text());
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        Use any chat assistant you already have. No account or key is needed
        here.
      </p>
      <div className="space-y-2">
        <p className="font-medium">1. Copy the prompt</p>
        <Button variant="outline" onClick={() => void copyPrompt()}>
          <ClipboardCopy className="size-4" aria-hidden /> Copy prompt
        </Button>
        {copied === "prompt" && (
          <span role="status" className="text-muted-foreground ml-2 text-xs">
            Copied. Paste it into your assistant and send.
          </span>
        )}
        {promptText && (
          <textarea
            readOnly
            value={promptText}
            rows={4}
            aria-label="The prompt to copy"
            className="bg-background w-full rounded-lg border p-2 text-xs"
          />
        )}
      </div>
      <div className="space-y-2">
        <label htmlFor="pasted-reply" className="font-medium">
          2. Paste the reply (or drop a .json file)
        </label>
        <textarea
          id="pasted-reply"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => void onDrop(e)}
          rows={5}
          placeholder="Paste the assistant's whole reply here; text around the JSON is fine"
          className="bg-background focus-visible:outline-ring w-full rounded-lg border p-3 focus-visible:outline-2"
        />
      </div>
      {result && !result.extracted.ok && (
        <p role="alert" className="text-destructive">
          {result.extracted.reason}
        </p>
      )}
      {errors.length > 0 && (
        <div role="alert" className="space-y-2">
          <ul className="text-destructive list-disc pl-5">
            {errors.map((e, i) => (
              <li key={i}>
                {e.path || "storyboard"}: {e.message}. Expected {e.expected}.
              </li>
            ))}
          </ul>
          <Button
            variant="outline"
            onClick={() => void copy(buildFixRequest(result!), "fix")}
          >
            Copy fix request
          </Button>
          {copied === "fix" && (
            <span role="status" className="text-muted-foreground ml-2 text-xs">
              Copied. Paste it back into the chat.
            </span>
          )}
        </div>
      )}
      {result?.lint && result.lint.fixes.length > 0 && (
        <p className="text-muted-foreground text-xs">
          Tidied automatically: {result.lint.fixes.length} small fix
          {result.lint.fixes.length === 1 ? "" : "es"}.
        </p>
      )}
      {valid && (
        <Button onClick={() => void make()} disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Make the video
        </Button>
      )}
      {!result && !error && (
        <p className="text-muted-foreground text-xs">
          Not asked yet? Your topic, format and length from above are filled
          into the prompt.
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
