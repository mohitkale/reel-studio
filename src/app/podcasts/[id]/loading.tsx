import { PageHeaderSkeleton } from "@/components/shell/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <PageHeaderSkeleton actions={1} />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
