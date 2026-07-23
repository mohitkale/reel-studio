"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Copy, Sparkles } from "lucide-react";

import type { PodcastCharacterDTO, PodcastLengthDTO } from "@/lib/dto";
import { podcastPlanSchema } from "@/library/podcast-schemas";
import { useImportPodcastScript } from "@/hooks/podcasts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  buildPodcastJsonPrompt,
  buildSamplePodcastJson,
} from "./podcast-json-prompt";

export function PodcastJsonDialog({
  podcastId,
  characters,
  length,
  open,
  onOpenChange,
}: {
  podcastId: string;
  characters: PodcastCharacterDTO[];
  length: PodcastLengthDTO;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-4 overflow-hidden">
        <DialogHeader>
          <DialogTitle>Paste podcast JSON</DialogTitle>
          <DialogDescription>
            Copy the character-aware prompt into ChatGPT or Claude, then paste
            the JSON here. Scripts should sound human — emotion, tone, and
            natural pauses in the spoken words.
          </DialogDescription>
        </DialogHeader>
        {/* Remount on open so the editor initializes from the latest cast. */}
        {open ? (
          <PodcastJsonEditor
            podcastId={podcastId}
            characters={characters}
            length={length}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PodcastJsonEditor({
  podcastId,
  characters,
  length,
  onClose,
}: {
  podcastId: string;
  characters: PodcastCharacterDTO[];
  length: PodcastLengthDTO;
  onClose: () => void;
}) {
  const importScript = useImportPodcastScript(podcastId);
  const [text, setText] = React.useState(() =>
    buildSamplePodcastJson(characters),
  );
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const prompt = React.useMemo(
    () => buildPodcastJsonPrompt(characters, length),
    [characters, length],
  );

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success("Prompt copied — paste into ChatGPT, Claude, etc.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy prompt");
    }
  }

  function submit() {
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setError("Invalid JSON — fix syntax and try again.");
      return;
    }
    const result = podcastPlanSchema.safeParse(parsed);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid podcast schema");
      return;
    }
    const known = new Set(characters.map((c) => c.key));
    for (const turn of result.data.turns) {
      if (!known.has(turn.characterId)) {
        setError(
          `Unknown characterId "${turn.characterId}". Expected: ${[...known].join(", ")}`,
        );
        return;
      }
    }
    importScript.mutate(
      { plan: result.data, updateMeta: true },
      {
        onSuccess: () => {
          toast.success("Script imported");
          onClose();
        },
        onError: (e) =>
          toast.error("Import failed", {
            description: (e as Error).message,
          }),
      },
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={copyPrompt}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy AI prompt"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Cast keys: {characters.map((c) => c.key).join(", ")} · {length}
        </span>
      </div>

      <textarea
        className="min-h-[280px] flex-1 resize-y rounded-md border bg-background p-3 font-mono text-xs leading-relaxed"
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        aria-label="Podcast JSON"
      />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={importScript.isPending}>
          <Sparkles className="size-4" />
          {importScript.isPending ? "Importing…" : "Import script"}
        </Button>
      </DialogFooter>
    </>
  );
}
