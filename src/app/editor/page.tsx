"use client";

import * as React from "react";
import Link from "next/link";
import { Clapperboard, ChevronRight, FileVideo } from "lucide-react";

import { useProjects } from "@/hooks/script";
import { LISTING_GRID_6_CARDS, type ListingViewMode } from "@/lib/listing-layout";
import { EngineBadge } from "@/components/engines/engine-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { ViewModeToggle } from "@/components/ui/view-mode-toggle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function EditorIndexPage() {
  const { data: projects, isLoading } = useProjects();
  const [view, setView] = React.useState<ListingViewMode>("grid");
  const openable = projects?.filter((p) => p.firstScriptId) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editor"
        description="Pick a project to open its script in the editor."
        actions={
          <ViewModeToggle value={view} onChange={setView} label="Editor projects" />
        }
      />

      {isLoading ? (
        view === "list" ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <div className={LISTING_GRID_6_CARDS}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        )
      ) : !openable.length ? (
        <EmptyState
          icon={Clapperboard}
          title="No projects yet"
          description="Create a project from the Projects page to start editing."
        />
      ) : view === "list" ? (
        <ul className="space-y-2">
          {openable.map((p) => (
            <li key={p.id}>
              <Link
                href={`/editor/${p.firstScriptId}`}
                className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-foreground/20 sm:p-4"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:size-12">
                  <Clapperboard className="size-4 sm:size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <EngineBadge engine={p.videoEngine} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px]">
                      {p.sceneCount} scenes
                    </Badge>
                    <span>
                      {p.scriptCount} script{p.scriptCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className={LISTING_GRID_6_CARDS}>
          {openable.map((p) => (
            <Link key={p.id} href={`/editor/${p.firstScriptId}`} className="group">
              <Card className="h-full transition-colors group-hover:border-foreground/20">
                <CardContent className="flex h-full flex-col gap-3 p-4">
                  <div className="relative flex aspect-video items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-secondary text-primary">
                    <FileVideo className="size-7" />
                    <div className="absolute left-2 top-2">
                      <EngineBadge engine={p.videoEngine} />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium leading-tight">
                      {p.name}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">
                        {p.sceneCount} scenes
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {p.scriptCount} script{p.scriptCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
