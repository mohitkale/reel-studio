"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { usePodcast } from "@/hooks/podcasts";
import { EpisodeProgress } from "@/components/podcasts/episode-progress";
import { PodcastWorkspace } from "@/components/podcasts/podcast-workspace";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/** The banner for an episode being made in one step, from `?job=`. */
function MakingBanner({ podcastId }: { podcastId: string }) {
  const job = useSearchParams().get("job");
  if (!job || !/^[A-Za-z0-9]{8,40}$/.test(job)) return null;
  return <EpisodeProgress podcastId={podcastId} jobId={job} />;
}

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

  return (
    <div className="flex flex-col gap-4">
      <Suspense fallback={null}>
        <MakingBanner podcastId={id} />
      </Suspense>
      <PodcastWorkspace podcast={podcast} />
    </div>
  );
}
