"use client";

import * as React from "react";

import { TEMPLATES } from "@/video/templates";
import { HyperFramesPlayer } from "@/components/editor/hyperframes-player";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LISTING_GRID_6_CARDS } from "@/lib/listing-layout";

const PREVIEW_DURATION = 90; // 3 seconds at 30fps
const PREVIEW_FPS = 30;

function TemplatePreviewCard({
  template,
}: {
  template: (typeof TEMPLATES)[0];
}) {
  const scene = React.useMemo(
    () => ({
      id: `preview-${template.id}`,
      templateId: template.id,
      text:
        template.id === "hf-data-chart"
          ? "Compare the supplied demo values."
          : template.sampleText,
      emphasis: template.id === "hf-data-chart" ? [] : template.sampleEmphasis,
      visual:
        template.id === "hf-data-chart"
          ? "Completion by stage"
          : template.sampleVisual,
      ...(template.id === "hf-list"
        ? { items: template.sampleText.split("\n") }
        : {}),
      ...(template.id === "hf-data-chart"
        ? {
            chart: {
              labels: ["Draft", "Review", "Release"],
              series: [
                {
                  label: "Illustrative values",
                  values: [42, 68, 91],
                  unit: "%",
                },
              ],
              sourceAttribution: "Demo data · illustrative only",
            },
          }
        : {}),
    }),
    [template],
  );

  const timeline = React.useMemo(
    () => [
      { sceneId: scene.id, startFrame: 0, durationFrames: PREVIEW_DURATION },
    ],
    [scene.id],
  );

  // Mounting all templates as live, autoplaying
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
          <HyperFramesPlayer
            key={scene.id}
            scenes={[scene]}
            timeline={timeline}
            totalFrames={PREVIEW_DURATION}
            fps={PREVIEW_FPS}
            loop
          />
        ) : (
          <div className="bg-muted/40 text-muted-foreground flex h-full w-full items-center justify-center text-xs">
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
        <p className="text-muted-foreground text-xs">{template.description}</p>
        {template.visualHint ? (
          <p className="text-muted-foreground/70 text-xs italic">
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
        description="Explore scene layouts with live previews. AI combines these with content-matched motion treatments; use Visual direction in the editor to refine the whole reel."
      />
      <div className={LISTING_GRID_6_CARDS}>
        {TEMPLATES.map((t) => (
          <TemplatePreviewCard key={t.id} template={t} />
        ))}
      </div>
    </div>
  );
}
