"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mic, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  useCreatePodcast,
  useDeletePodcast,
  usePodcasts,
} from "@/hooks/podcasts";
import {
  LISTING_GRID_6_CARDS,
  type ListingViewMode,
} from "@/lib/listing-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ViewModeToggle } from "@/components/ui/view-mode-toggle";
import {
  PODCAST_PRESETS,
  type PodcastPresetId,
} from "@/library/podcast-presets";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function NewPodcastDialog() {
  const router = useRouter();
  const create = useCreatePodcast();
  const [title, setTitle] = React.useState("");
  const [presetId, setPresetId] = React.useState<PodcastPresetId>(
    "two-host-discussion",
  );
  const [open, setOpen] = React.useState(false);

  function submit() {
    const trimmed = title.trim() || "Untitled podcast";
    create.mutate(
      { title: trimmed, length: "short", presetId },
      {
        onSuccess: (podcast) => {
          setOpen(false);
          setTitle("");
          toast.success("Podcast created");
          router.push(`/podcasts/${podcast.id}`);
        },
        onError: (e) =>
          toast.error("Could not create podcast", {
            description: (e as Error).message,
          }),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          New podcast
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New podcast</DialogTitle>
          <DialogDescription>
            Start with a production-ready format, then add your topic and
            voices.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="new-pod-title">Title</Label>
          <Input
            id="new-pod-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled podcast"
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
        </div>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Format</legend>
          <div className="grid gap-2">
            {Object.values(PODCAST_PRESETS).map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`rounded-lg border p-3 text-left transition-colors ${
                  presetId === preset.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/40"
                }`}
                onClick={() => setPresetId(preset.id)}
              >
                <span className="block text-sm font-medium">
                  {preset.label}
                </span>
                <span className="text-muted-foreground mt-0.5 block text-xs">
                  {preset.description}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PodcastsPage() {
  const { data: podcasts, isLoading } = usePodcasts();
  const del = useDeletePodcast();
  const [view, setView] = React.useState<ListingViewMode>("grid");
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const deleting = podcasts?.find((p) => p.id === deletingId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Podcasts"
        description="Voice-only multi-speaker episodes — create, script, and generate audio"
        actions={
          <div className="flex items-center gap-2">
            <ViewModeToggle value={view} onChange={setView} />
            <NewPodcastDialog />
          </div>
        }
      />

      {isLoading ? (
        <div className={view === "grid" ? LISTING_GRID_6_CARDS : "space-y-2"}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : !podcasts?.length ? (
        <EmptyState
          icon={Mic}
          title="No podcasts yet"
          description="Create a podcast, pick character voices, generate a humanised script, then produce audio in one click."
        />
      ) : view === "list" ? (
        <div className="space-y-2">
          {podcasts.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                <div className="from-primary/15 to-secondary text-primary flex h-14 w-full shrink-0 items-center justify-center rounded-md bg-gradient-to-br sm:w-24">
                  <Mic className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate leading-tight font-medium">
                    {p.title}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{p.length}</Badge>
                    <Badge variant="outline">
                      {PODCAST_PRESETS[p.presetId].label}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {p.characterCount} voices · {p.turnCount} turns ·{" "}
                      {p.takeCount} takes
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button asChild size="sm">
                    <Link href={`/podcasts/${p.id}`}>Open</Link>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Delete ${p.title}`}
                    onClick={() => setDeletingId(p.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className={LISTING_GRID_6_CARDS}>
          {podcasts.map((p) => (
            <Card key={p.id} className="group flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-3 p-4">
                <div className="from-primary/15 to-secondary text-primary flex aspect-video items-center justify-center rounded-lg bg-gradient-to-br">
                  <Mic className="size-7" />
                </div>
                <div className="flex-1">
                  <h3 className="line-clamp-2 text-sm leading-tight font-medium">
                    {p.title}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      {p.length}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {PODCAST_PRESETS[p.presetId].label}
                    </Badge>
                    <span className="text-muted-foreground text-[10px]">
                      {p.turnCount} turns · {p.takeCount} takes
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button asChild size="sm" className="flex-1">
                    <Link href={`/podcasts/${p.id}`}>Open</Link>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Delete ${p.title}`}
                    onClick={() => setDeletingId(p.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null);
        }}
        title="Delete podcast?"
        description={`Delete "${deleting?.title}"? This removes the script and all audio takes.`}
        confirmLabel="Delete podcast"
        onConfirm={() => {
          if (!deletingId) return;
          del.mutate(deletingId, {
            onSuccess: () => {
              toast.info("Podcast deleted");
              setDeletingId(null);
            },
          });
        }}
        isPending={del.isPending}
      />
    </div>
  );
}
