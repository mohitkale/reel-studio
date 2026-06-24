import { PageHeaderSkeleton, CardGridSkeleton } from "@/components/shell/page-skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton actions={1} />
      <CardGridSkeleton count={4} itemClassName="h-44" />
    </div>
  );
}
