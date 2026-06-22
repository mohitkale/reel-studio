"use client";

import { Library } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shell/page-header";

export default function AssetsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Assets"
        description="Manage images, Lottie files, icons and avatars for reuse."
      />
      <EmptyState
        icon={Library}
        title="The asset library arrives in milestone 6"
        description="Upload and organize images, Lottie JSON, icons and avatars, stored locally and reusable across projects."
      />
    </div>
  );
}
