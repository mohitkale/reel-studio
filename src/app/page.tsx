"use client";
import { QueryError } from "@/components/ui/query-error";

import { CreationHub } from "@/components/studio/creation-hub";
import { CreationReadiness } from "@/components/projects/creation-readiness";
import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Plus,
  Clapperboard,
  Trash2,
  FileVideo,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { toast } from "sonner";

import {
  useProjects,
  useCreateProject,
  useDeleteProject,
  useOrganizeProject,
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
  const {
    data: projects,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useProjects();
  const del = useDeleteProject();
  const organize = useOrganizeProject();
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("active");
  const [series, setSeries] = React.useState("");
  const filtered = projects?.filter(
    (p) =>
      (status === "archived" ? Boolean(p.archivedAt) : !p.archivedAt) &&
      (status !== "ready" || p.status === "ready") &&
      (status !== "draft" || p.status !== "ready") &&
      (!series || p.series === series) &&
      p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [view, setView] = React.useState<ListingViewMode>("grid");

  const deletingProject = projects?.find((p) => p.id === deletingId) ?? null;

  return (
    <div className="space-y-8">
      <CreationHub />
      <details className="rounded-xl border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Check creation readiness
        </summary>
        <div className="mt-3">
          <CreationReadiness />
        </div>
      </details>
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

      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          aria-label="Search projects"
          placeholder="Search projects…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <NativeSelect
          aria-label="Project status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="active">Active projects</option>
          <option value="draft">Drafts</option>
          <option value="ready">With narration</option>
          <option value="archived">Archived</option>
        </NativeSelect>
        <NativeSelect
          aria-label="Series"
          value={series}
          onChange={(event) => setSeries(event.target.value)}
        >
          <option value="">All series</option>
          {[...new Set(projects?.map((p) => p.series).filter(Boolean))].map(
            (value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ),
          )}
        </NativeSelect>
      </div>
      {isError && (
        <QueryError
          title="Could not load projects"
          error={error}
          retry={refetch}
          pending={isFetching}
        />
      )}
      {isError && !projects ? null : isLoading ? (
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
      ) : !filtered?.length ? (
        <EmptyState
          icon={Clapperboard}
          title={projects?.length ? "No matching projects" : "No projects yet"}
          description="Choose Create with AI for an idea, or Create production for a script, article, or uploads."
        />
      ) : view === "list" ? (
        <div className="space-y-2">
          {filtered.map((p) => (
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
                        p.firstScriptId
                          ? `/${p.outputType === "voiceover" ? "voiceovers" : "editor"}/${p.firstScriptId}`
                          : "#"
                      }
                    >
                      Open studio
                    </Link>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={
                      p.archivedAt ? `Restore ${p.name}` : `Archive ${p.name}`
                    }
                    disabled={organize.isPending}
                    onClick={() =>
                      organize.mutate(
                        { id: p.id, archived: !p.archivedAt },
                        { onError: (error) => toast.error(error.message) },
                      )
                    }
                  >
                    {p.archivedAt ? (
                      <ArchiveRestore className="size-4" />
                    ) : (
                      <Archive className="size-4" />
                    )}
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
          {filtered.map((p) => (
            <Card key={p.id} className="group flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-3 p-4">
                <div className="from-primary/15 to-secondary text-primary relative flex aspect-video items-center justify-center rounded-lg bg-gradient-to-br">
                  {p.thumbnailUrl ? (
                    <Image
                      fill
                      unoptimized
                      sizes="(min-width: 1280px) 16vw, (min-width: 640px) 33vw, 100vw"
                      src={p.thumbnailUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full rounded-lg object-cover"
                    />
                  ) : (
                    <div className="px-4 text-center text-sm font-semibold">
                      <span className="mb-2 block text-[10px] font-normal tracking-wider uppercase">
                        {p.openingText ? "Opening scene" : "Blank project"}
                      </span>
                      <span className="line-clamp-4">
                        {p.openingText || p.name}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <Input
                    aria-label={`Series for ${p.name}`}
                    placeholder="Add to series…"
                    defaultValue={p.series ?? ""}
                    maxLength={80}
                    onBlur={(event) => {
                      if (event.target.value.trim() !== (p.series ?? ""))
                        organize.mutate(
                          { id: p.id, series: event.target.value.trim() },
                          { onError: (error) => toast.error(error.message) },
                        );
                    }}
                    className="mb-2 h-8 text-xs"
                  />
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
                        p.firstScriptId
                          ? `/${p.outputType === "voiceover" ? "voiceovers" : "editor"}/${p.firstScriptId}`
                          : "#"
                      }
                    >
                      Open
                    </Link>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={
                      p.archivedAt ? `Restore ${p.name}` : `Archive ${p.name}`
                    }
                    disabled={organize.isPending}
                    onClick={() =>
                      organize.mutate(
                        { id: p.id, archived: !p.archivedAt },
                        { onError: (error) => toast.error(error.message) },
                      )
                    }
                  >
                    {p.archivedAt ? (
                      <ArchiveRestore className="size-4" />
                    ) : (
                      <Archive className="size-4" />
                    )}
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
