import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton, CardGridSkeleton } from "@/components/shell/page-skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={1} />
      <Skeleton className="h-9 w-72 max-w-full" />
      <CardGridSkeleton
        count={8}
        itemClassName="h-40"
        className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
      />
    </div>
  );
}
