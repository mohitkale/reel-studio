"use client";

import * as React from "react";

import { TEMPLATES } from "@/compositions/templates";
import { ReelPlayer } from "@/components/editor/reel-player";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LISTING_GRID_6_CARDS } from "@/lib/listing-layout";

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

  // Mounting all 7 templates (including 3D + Lottie) as live, autoplaying
  // Players at once is heavy on CPU/GPU. Only mount the actual Player once the
  // card scrolls into view, and unmount it again once it scrolls away.
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin: "200px 0px", threshold: 0.01 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Card className="overflow-hidden">
      <div
        ref={containerRef}
        className="mx-auto w-full max-w-[220px] xl:max-w-none"
        style={{ aspectRatio: "1080 / 1920" }}
      >
        {isVisible ? (
          <ReelPlayer
            key={scene.id}
            scenes={[scene]}
            timeline={timeline}
            totalFrames={PREVIEW_DURATION}
            fps={PREVIEW_FPS}
            loop
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted/40 text-xs text-muted-foreground">
            Scroll to preview
          </div>
        )}
      </div>
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
      <div className={LISTING_GRID_6_CARDS}>
        {TEMPLATES.map((t) => (
          <TemplatePreviewCard key={t.id} template={t} />
        ))}
      </div>
    </div>
  );
}
