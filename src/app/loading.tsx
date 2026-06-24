import { PageHeaderSkeleton, CardGridSkeleton } from "@/components/shell/page-skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton actions={2} />
      <CardGridSkeleton count={6} itemClassName="h-36" />
    </div>
  );
}
