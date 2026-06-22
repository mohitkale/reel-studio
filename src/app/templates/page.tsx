"use client";

import { LayoutTemplate } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shell/page-header";

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates"
        description="A gallery of premium animated scene templates."
      />
      <EmptyState
        icon={LayoutTemplate}
        title="Templates arrive in milestone 4"
        description="Kinetic typography, Lottie explainers, and Three.js 3D accents with animated previews will appear here."
      />
    </div>
  );
}
