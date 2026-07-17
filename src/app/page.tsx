"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Clapperboard, Trash2, FileVideo } from "lucide-react";
import { toast } from "sonner";

import { useProjects, useCreateProject, useDeleteProject } from "@/hooks/script";
import { LISTING_GRID_6_CARDS, type ListingViewMode } from "@/lib/listing-layout";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import {
  type Orientation,
  ORIENTATIONS,
  ORIENTATION_LABELS,
  DEFAULT_ORIENTATION,
} from "@/lib/orientation";
import {
  DEFAULT_VIDEO_ENGINE,
  VIDEO_ENGINE_DESCRIPTIONS,
  VIDEO_ENGINE_IDS,
  VIDEO_ENGINE_LABELS,
  type VideoEngineId,
} from "@/engines/types";
import { EngineBadge } from "@/components/engines/engine-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CreateWithAIDialog } from "@/components/projects/create-with-ai-dialog";
import { ViewModeToggle } from "@/components/ui/view-mode-toggle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

function NewProjectDialog() {
  const router = useRouter();
  const create = useCreateProject();
  const [name, setName] = React.useState("");
  const [orientation, setOrientation] =
    React.useState<Orientation>(DEFAULT_ORIENTATION);
  const [videoEngine, setVideoEngine] =
    React.useState<VideoEngineId>(DEFAULT_VIDEO_ENGINE);
  const [open, setOpen] = React.useState(false);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    create.mutate(
      { name: trimmed, orientation, videoEngine },
      {
        onSuccess: ({ scriptId }) => {
          setOpen(false);
          setName("");
          setVideoEngine(DEFAULT_VIDEO_ENGINE);
          toast.success("Project created");
          router.push(`/editor/${scriptId}`);
        },
        onError: (e) =>
          toast.error("Could not create project", {
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
          New project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Choose a video engine, then name your project. Engine cannot be
            changed later.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Video engine</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {VIDEO_ENGINE_IDS.map((id) => {
                const selected = videoEngine === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setVideoEngine(id)}
                    className={
                      selected
                        ? "rounded-lg border border-primary bg-primary/5 p-3 text-left"
                        : "rounded-lg border p-3 text-left hover:bg-muted/40"
                    }
                  >
                    <div className="font-medium">{VIDEO_ENGINE_LABELS[id]}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {VIDEO_ENGINE_DESCRIPTIONS[id]}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              autoFocus
              placeholder="e.g. Launch teaser"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project-orientation">Orientation</Label>
            <Combobox
              id="project-orientation"
              value={orientation}
              onChange={(v) => setOrientation(v as Orientation)}
              options={ORIENTATIONS.map((o) => ({
                value: o,
                label: ORIENTATION_LABELS[o],
              }))}
              searchPlaceholder="Search…"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button onClick={submit} disabled={!name.trim() || create.isPending}>
            {create.isPending ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();
  const del = useDeleteProject();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [view, setView] = React.useState<ListingViewMode>("grid");

  const deletingProject = projects?.find((p) => p.id === deletingId) ?? null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Projects"
        description="Create and manage your short-form video projects."
        actions={
          <>
            <ViewModeToggle value={view} onChange={setView} label="Projects" />
            <CreateWithAIDialog />
            <NewProjectDialog />
          </>
        }
      />

      {isLoading ? (
        view === "list" ? (
          <div className="space-y-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : (
          <div className={LISTING_GRID_6_CARDS}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
        )
      ) : !projects?.length ? (
        <EmptyState
          icon={Clapperboard}
          title="No projects yet"
          description="Create your first project to start writing a script and generating voiceovers."
        />
      ) : view === "list" ? (
        <div className="space-y-2">
          {projects.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                <div className="flex h-14 w-full shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary/15 to-secondary text-primary sm:w-24">
                  <FileVideo className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-medium leading-tight">{p.name}</h3>
                    <EngineBadge engine={p.videoEngine} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{p.sceneCount} scenes</Badge>
                    <span className="text-xs text-muted-foreground">
                      {p.scriptCount} script{p.scriptCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    asChild
                    size="sm"
                    disabled={!p.firstScriptId}
                  >
                    <Link href={p.firstScriptId ? `/editor/${p.firstScriptId}` : "#"}>
                      Open editor
                    </Link>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Delete ${p.name}`}
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
          {projects.map((p) => (
            <Card key={p.id} className="group flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-3 p-4">
                <div className="relative flex aspect-video items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-secondary text-primary">
                  <FileVideo className="size-7" />
                  <div className="absolute left-2 top-2">
                    <EngineBadge engine={p.videoEngine} />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="line-clamp-2 text-sm font-medium leading-tight">
                    {p.name}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      {p.sceneCount} scenes
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {p.scriptCount} script{p.scriptCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    asChild
                    size="sm"
                    className={cn("flex-1", !p.firstScriptId && "pointer-events-none opacity-50")}
                    disabled={!p.firstScriptId}
                  >
                    <Link href={p.firstScriptId ? `/editor/${p.firstScriptId}` : "#"}>
                      Open
                    </Link>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Delete ${p.name}`}
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
        title="Delete project?"
        description={`Delete "${deletingProject?.name}"? This will permanently remove the project, all its scenes, scripts, and voice takes.`}
        confirmLabel="Delete project"
        onConfirm={() => {
          if (!deletingId) return;
          del.mutate(deletingId, {
            onSuccess: () => {
              toast.info("Project deleted");
              setDeletingId(null);
            },
          });
        }}
        isPending={del.isPending}
      />
    </div>
  );
}
