"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileDown, FileUp, ScrollText } from "lucide-react";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Export the project as a Storyboard v1 JSON file, or import one. Import makes
 * a new editable project from the storyboard (nothing is rendered) and opens it;
 * the current project is left untouched.
 */
export function StoryboardMenu({ scriptId }: { scriptId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function exportJson() {
    try {
      const response = await fetch(`/api/scripts/${scriptId}/storyboard`);
      const json = await response.json();
      if (!response.ok || !json.storyboard) {
        throw new Error(
          json.errors?.[0]?.message ?? json.error ?? "Could not export",
        );
      }
      const link = document.createElement("a");
      link.href = `/api/scripts/${scriptId}/storyboard?download=1`;
      link.download = "";
      document.body.append(link);
      link.click();
      link.remove();
      if (json.notes?.length) {
        toast.message("Exported with notes", {
          description: json.notes.slice(0, 3).join(" · "),
        });
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not export the storyboard",
      );
    }
  }

  async function importJson() {
    setBusy(true);
    try {
      const response = await fetch("/api/storyboards?createOnly=1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // The server lints and repairs the text, so a pasted chat reply works too.
        body: JSON.stringify({ storyboard: text }),
      });
      const json = await response.json();
      if (!response.ok || !json.scriptId) {
        const first = json.errors?.[0];
        throw new Error(
          first
            ? `${first.path || "storyboard"}: ${first.message}`
            : (json.error ?? "Could not import"),
        );
      }
      toast.success("Storyboard imported as a new project");
      setOpen(false);
      setText("");
      router.push(`/editor/${json.scriptId}`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not import the storyboard",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <ScrollText className="size-3.5" />
            Storyboard
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={exportJson}>
            <FileDown className="size-3.5" />
            Export storyboard JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpen(true)}>
            <FileUp className="size-3.5" />
            Import storyboard JSON…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import storyboard JSON</DialogTitle>
            <DialogDescription>
              Paste a Storyboard v1 document, or the reply from any chat app. It
              is checked and repaired, then opened as a new project. This
              project is not changed.
            </DialogDescription>
          </DialogHeader>
          <textarea
            className="border-input bg-background h-72 w-full rounded-md border p-3 font-mono text-xs"
            placeholder='{ "version": 1, "title": "…", "scenes": [ … ] }'
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-label="Storyboard JSON"
          />
          <input
            type="file"
            accept="application/json,.json,.txt"
            aria-label="Choose a storyboard file"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) setText(await file.text());
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={importJson}
              disabled={busy || text.trim().length === 0}
            >
              {busy ? "Importing…" : "Import as new project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
