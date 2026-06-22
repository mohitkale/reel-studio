"use client";

import * as React from "react";

import { TEMPLATES } from "@/compositions/templates";
import { ReelPlayer } from "@/components/editor/reel-player";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const PREVIEW_DURATION = 90; // 3 seconds at 30fps
const PREVIEW_FPS = 30;

function TemplatePreviewCard({ template }: { template: typeof TEMPLATES[0] }) {
  const scene = React.useMemo(
    () => ({
      id: `preview-${template.id}`,
      templateId: template.id,
      text: template.sampleText,
      emphasis: template.sampleEmphasis,
      visual: template.sampleVisual,
    }),
    [template],
  );

  const timeline = React.useMemo(
    () => [{ sceneId: scene.id, startFrame: 0, durationFrames: PREVIEW_DURATION }],
    [scene.id],
  );

  return (
    <Card className="overflow-hidden">
      <ReelPlayer
        key={scene.id}
        scenes={[scene]}
        timeline={timeline}
        totalFrames={PREVIEW_DURATION}
        fps={PREVIEW_FPS}
        autoPlay
        loop
      />
      <div className="space-y-1 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{template.name}</h3>
          {template.visualHint ? (
            <Badge variant="secondary" className="text-xs">
              visual slot
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{template.description}</p>
        {template.visualHint ? (
          <p className="text-xs text-muted-foreground/70 italic">
            {template.visualHint}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates"
        description="Seven premium animated scene templates with live previews. Pick any in the scene inspector."
      />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {TEMPLATES.map((t) => (
          <TemplatePreviewCard key={t.id} template={t} />
        ))}
      </div>
    </div>
  );
}
