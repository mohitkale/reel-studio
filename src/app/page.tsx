"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Clapperboard, Trash2, FileVideo } from "lucide-react";
import { toast } from "sonner";

import { useProjects, useCreateProject, useDeleteProject } from "@/hooks/script";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { CreateWithAIDialog } from "@/components/projects/create-with-ai-dialog";
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
  const [open, setOpen] = React.useState(false);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    create.mutate(trimmed, {
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
    });
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
            Give your project a name. You can rename scenes and scripts later.
          </DialogDescription>
        </DialogHeader>
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

  return (
    <div className="space-y-8">
      <PageHeader
        title="Projects"
        description="Create and manage your short-form video projects."
        actions={
          <>
            <CreateWithAIDialog />
            <NewProjectDialog />
          </>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : !projects?.length ? (
        <EmptyState
          icon={Clapperboard}
          title="No projects yet"
          description="Create your first project to start writing a script and generating voiceovers."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card key={p.id} className="group flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex aspect-video items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-secondary text-primary">
                  <FileVideo className="size-8" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium leading-tight">{p.name}</h3>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="secondary">{p.sceneCount} scenes</Badge>
                    <span className="text-xs text-muted-foreground">
                      {p.scriptCount} script{p.scriptCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    asChild
                    size="sm"
                    className="flex-1"
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
                    onClick={() =>
                      del.mutate(p.id, {
                        onSuccess: () => toast.info("Project deleted"),
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
