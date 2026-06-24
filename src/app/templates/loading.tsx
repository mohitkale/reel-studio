import { PageHeaderSkeleton, CardGridSkeleton } from "@/components/shell/page-skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <CardGridSkeleton
        count={8}
        itemClassName="h-80"
        className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      />
    </div>
  );
}
