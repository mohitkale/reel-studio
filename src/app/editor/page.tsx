"use client";

import Link from "next/link";
import { Clapperboard, ChevronRight } from "lucide-react";

import { useProjects } from "@/hooks/script";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shell/page-header";

export default function EditorIndexPage() {
  const { data: projects, isLoading } = useProjects();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editor"
        description="Pick a project to open its script in the editor."
      />

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : !projects?.length ? (
        <EmptyState
          icon={Clapperboard}
          title="No projects yet"
          description="Create a project from the Projects page to start editing."
        />
      ) : (
        <ul className="space-y-2">
          {projects
            .filter((p) => p.firstScriptId)
            .map((p) => (
              <li key={p.id}>
                <Link
                  href={`/editor/${p.firstScriptId}`}
                  className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20"
                >
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Clapperboard className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.sceneCount} scenes
                    </p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
