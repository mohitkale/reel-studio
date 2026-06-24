import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  // Mirrors the editor workspace layout (see EditorClient): a title row above a
  // three-panel grid (script / scene controls / reel preview).
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 lg:grid-cols-[minmax(20rem,1fr)_22rem_22rem]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
