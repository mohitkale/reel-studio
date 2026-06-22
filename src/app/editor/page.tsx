"use client";

import { Clapperboard } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shell/page-header";

export default function EditorPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Editor"
        description="Write scripts scene by scene, voice them, and preview live."
      />
      <EmptyState
        icon={Clapperboard}
        title="The editor arrives in milestone 3"
        description="A reorderable scene list, live Remotion preview, and a scene inspector will live here. Create a project first to open it."
      />
    </div>
  );
}
