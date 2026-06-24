import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/shell/page-skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
