"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api-client";
import {
  filmPlanDocumentSchema,
  type FilmPlanDocument,
} from "@/production/film-plan-document";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function FilmPlanDialog({
  scriptId,
  voiceTakeId,
}: {
  scriptId: string;
  voiceTakeId?: string;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [revisionId, setRevisionId] = useState<string>();
  const endpoint = `/api/scripts/${encodeURIComponent(scriptId)}/film-plan`;
  async function load() {
    setBusy(true);
    try {
      const query = voiceTakeId
        ? `?voiceTakeId=${encodeURIComponent(voiceTakeId)}`
        : "";
      const document = await apiGet<FilmPlanDocument>(endpoint + query);
      setValue(JSON.stringify(document, null, 2));
      setRevisionId(undefined);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load film plan",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    try {
      const document = filmPlanDocumentSchema.parse(JSON.parse(value));
      const result = await apiPost<{ revisionId: string }>(endpoint, {
        document,
      });
      setRevisionId(result.revisionId);
      toast.success("Film plan revision saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save film plan",
      );
    } finally {
      setBusy(false);
    }
  }
  function download() {
    try {
      const document = filmPlanDocumentSchema.parse(JSON.parse(value));
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(document, null, 2)], {
          type: "application/json",
        }),
      );
      const link = documentLink(url);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("Load a valid film plan before downloading");
    }
  }
  function documentLink(url: string) {
    const link = document.createElement("a");
    link.href = url;
    link.download = "reel-studio-film-plan.json";
    return link;
  }
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          Film plan JSON
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Film plan checkpoint</DialogTitle>
          <DialogDescription>
            Download or paste a plan for this script, then save an immutable
            revision. This preserves the current design. Edit scenes in the
            editor and reload the plan after changes. Media files are
            referenced, not included.
          </DialogDescription>
        </DialogHeader>
        <textarea
          aria-label="Film plan JSON"
          className="h-80 w-full rounded-md border p-3 font-mono text-xs"
          value={value}
          disabled={busy}
          onChange={(event) => {
            setValue(event.target.value);
            setRevisionId(undefined);
          }}
          spellCheck={false}
        />
        {revisionId ? (
          <p className="text-sm" role="status">
            Saved revision: {revisionId}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => void load()}>
            Reload current plan
          </Button>
          <Button
            variant="outline"
            disabled={busy || !value}
            onClick={download}
          >
            Download JSON
          </Button>
          <Button disabled={busy || !value} onClick={() => void save()}>
            {busy ? "Working…" : "Save revision"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
