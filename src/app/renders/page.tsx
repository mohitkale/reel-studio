"use client";

import { ListVideo } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shell/page-header";

export default function RendersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Renders"
        description="Track render jobs and download finished videos."
      />
      <EmptyState
        icon={ListVideo}
        title="The render queue arrives in milestone 5"
        description="Server-side renders with live progress, output players and downloads will be listed here."
      />
    </div>
  );
}
