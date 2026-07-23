"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { usePodcast } from "@/hooks/podcasts";
import { PodcastWorkspace } from "@/components/podcasts/podcast-workspace";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function PodcastDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: podcast, isLoading, error } = usePodcast(id);

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !podcast) {
    return (
      <EmptyState
        title="Podcast not found"
        description="It may have been deleted."
        action={
          <Button asChild variant="secondary">
            <Link href="/podcasts">
              <ArrowLeft className="size-4" />
              Back to podcasts
            </Link>
          </Button>
        }
      />
    );
  }

  return <PodcastWorkspace podcast={podcast} />;
}
