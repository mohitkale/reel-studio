"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Clapperboard,
  Trash2,
  FileVideo,
  Sparkles,
  FileText,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

import {
  useProjects,
  useCreateProject,
  useDeleteProject,
} from "@/hooks/script";
import {
  LISTING_GRID_6_CARDS,
  type ListingViewMode,
} from "@/lib/listing-layout";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  type Orientation,
  ORIENTATIONS,
  ORIENTATION_LABELS,
  DEFAULT_ORIENTATION,
} from "@/lib/orientation";
import { DEFAULT_VIDEO_ENGINE } from "@/engines/types";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CreateWithAIDialog } from "@/components/projects/create-with-ai-dialog";
import { CreationWizard } from "@/components/projects/creation-wizard";
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
  const videoEngine = DEFAULT_VIDEO_ENGINE;
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
        <Button variant="outline">
          <Plus />
          Blank project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Blank project</DialogTitle>
          <DialogDescription>
            Name your project and choose its format.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
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
            <NativeSelect
              id="project-orientation"
              value={orientation}
              onChange={(event) =>
                setOrientation(event.target.value as Orientation)
              }
            >
              {ORIENTATIONS.map((value) => (
                <option key={value} value={value}>
                  {ORIENTATION_LABELS[value]}
                </option>
              ))}
            </NativeSelect>
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
      <section aria-labelledby="create-heading" className="space-y-5">
        <div>
          <h1
            id="create-heading"
            className="text-3xl font-semibold tracking-tight"
          >
            Turn your ideas into videos
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
            Start with an idea or your own content. Reel Studio arranges the
            scenes, applies a visual preset, and prepares an editable video.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <CreateWithAIDialog
            trigger={
              <button
                type="button"
                className="bg-primary/5 hover:bg-primary/10 focus-visible:ring-ring border-primary/40 flex h-full flex-col items-start rounded-2xl border p-6 text-left transition-colors focus-visible:ring-2"
              >
                <div className="mb-4 flex w-full items-center justify-between gap-3">
                  <Sparkles className="text-primary size-7" />
                  <Badge>Recommended</Badge>
                </div>
                <h2 className="text-xl font-semibold">Create with AI</h2>
                <p className="text-muted-foreground mt-2 text-sm">
                  Describe an idea. AI writes the script and plans varied scenes
                  with styling and relevant media.
                </p>
                <span className="text-muted-foreground mt-3 text-xs">
                  Uses your configured AI provider · Presets ready to use
                </span>
                <span className="text-primary mt-5 flex items-center gap-2 text-sm font-medium">
                  Start with an idea <ArrowRight className="size-4" />
                </span>
              </button>
            }
          />
          <CreationWizard
            trigger={
              <button
                type="button"
                className="bg-card hover:bg-muted/40 focus-visible:ring-ring flex h-full flex-col items-start rounded-2xl border p-6 text-left transition-colors focus-visible:ring-2"
              >
                <FileText className="text-primary mb-4 size-7" />
                <h2 className="text-xl font-semibold">Create production</h2>
                <p className="text-muted-foreground mt-2 text-sm">
                  Bring a script, article, or notes and optional uploads. Build
                  styled scenes locally, ready for narration and export.
                </p>
                <span className="text-muted-foreground mt-3 text-xs">
                  No AI key needed · Your content, arranged into scenes
                </span>
                <span className="text-primary mt-5 flex items-center gap-2 text-sm font-medium">
                  Start with your content <ArrowRight className="size-4" />
                </span>
              </button>
            }
          />
        </div>
        <p className="text-muted-foreground text-xs">
          1. Add content · 2. Create your draft · 3. Review, add narration, and
          export. Want a finished MP4 automatically? Enable Quick Produce in
          Create with AI.
        </p>
      </section>
      <PageHeader
        title="Your projects"
        description="Continue editing a draft or start a blank project for manual scene setup."
        actions={
          <>
            <NewProjectDialog />
            <ViewModeToggle value={view} onChange={setView} label="Projects" />
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
          description="Choose Create with AI for an idea, or Create production for a script, article, or uploads."
        />
      ) : view === "list" ? (
        <div className="space-y-2">
          {projects.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                <div className="from-primary/15 to-secondary text-primary flex h-14 w-full shrink-0 items-center justify-center rounded-md bg-gradient-to-br sm:w-24">
                  <FileVideo className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate leading-tight font-medium">
                      {p.name}
                    </h3>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{p.sceneCount} scenes</Badge>
                    <span className="text-muted-foreground text-xs">
                      {p.scriptCount} script{p.scriptCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button asChild size="sm" disabled={!p.firstScriptId}>
                    <Link
                      href={
                        p.firstScriptId ? `/editor/${p.firstScriptId}` : "#"
                      }
                    >
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
                <div className="from-primary/15 to-secondary text-primary relative flex aspect-video items-center justify-center rounded-lg bg-gradient-to-br">
                  <FileVideo className="size-7" />
                </div>
                <div className="flex-1">
                  <h3 className="line-clamp-2 text-sm leading-tight font-medium">
                    {p.name}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      {p.sceneCount} scenes
                    </Badge>
                    <span className="text-muted-foreground text-[10px]">
                      {p.scriptCount} script{p.scriptCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    asChild
                    size="sm"
                    className={cn(
                      "flex-1",
                      !p.firstScriptId && "pointer-events-none opacity-50",
                    )}
                    disabled={!p.firstScriptId}
                  >
                    <Link
                      href={
                        p.firstScriptId ? `/editor/${p.firstScriptId}` : "#"
                      }
                    >
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
