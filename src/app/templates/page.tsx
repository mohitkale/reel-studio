"use client";

import * as React from "react";
import { SHOWPIECES } from "@/video/semantic-graphic";
import { ShowpiecePreviewCard } from "@/components/editor/showpiece-preview-card";

import { MOTION_SAMPLES } from "@/video/motion-samples";
import { EXTENSION_MOTION_RECIPES } from "@/video/motion-extensions";
import {
  VISUAL_THEMES,
  applyVisualTheme,
} from "@/production/creative-direction";
import { defaultBrandTokens } from "@/video/tokens";
import { Button } from "@/components/ui/button";
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

function MotionPreviewCard({ index }: { index: number }) {
  const scene = MOTION_SAMPLES[index];
  const recipe = EXTENSION_MOTION_RECIPES[index];
  const ref = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "100px", threshold: 0.01 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const theme =
    recipe.id === "type-poster"
      ? VISUAL_THEMES.signal
      : recipe.id.startsWith("data-") ||
          recipe.id === "type-window" ||
          recipe.id === "list-grid"
        ? VISUAL_THEMES.circuit
        : VISUAL_THEMES.paper;
  return (
    <Card className="overflow-hidden">
      <div ref={ref} style={{ aspectRatio: "1080 / 1920" }}>
        {visible ? (
          <HyperFramesPlayer
            scenes={[scene]}
            timeline={[
              { sceneId: scene.id, startFrame: 0, durationFrames: 120 },
            ]}
            totalFrames={120}
            fps={30}
            loop
            tokens={applyVisualTheme(defaultBrandTokens, theme)}
          />
        ) : (
          <div className="bg-muted/40 text-muted-foreground flex h-full items-center justify-center text-xs">
            Scroll to preview
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <h3 className="text-sm font-semibold">{recipe.name}</h3>
        <p className="text-muted-foreground text-xs">{recipe.description}</p>
        <p className="text-muted-foreground text-xs">
          {recipe.content === "data"
            ? "Requires supplied values"
            : recipe.content === "list"
              ? "Requires supplied list items"
              : recipe.content === "image"
                ? "Requires a supplied image"
                : "Works with supplied text"}
        </p>
      </div>
    </Card>
  );
}

export default function TemplatesPage() {
  const [view, setView] = React.useState<"showpieces" | "motion" | "layouts">(
    "showpieces",
  );
  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates & motion"
        description="Explore story-driven motion with dimensional scenes, progressive reveals and sound accents. AI chooses from your content; manual treatments and layouts remain available."
      />
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Preview category"
      >
        <Button
          variant={view === "showpieces" ? "default" : "outline"}
          aria-pressed={view === "showpieces"}
          onClick={() => setView("showpieces")}
        >
          Story motion
        </Button>
        <Button
          variant={view === "motion" ? "default" : "outline"}
          aria-pressed={view === "motion"}
          onClick={() => setView("motion")}
        >
          Motion treatments
        </Button>
        <Button
          variant={view === "layouts" ? "default" : "outline"}
          aria-pressed={view === "layouts"}
          onClick={() => setView("layouts")}
        >
          Scene layouts
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">
        {view === "showpieces"
          ? "Each example develops over eight seconds. Play to see the action and hear sparse sound accents. Copy is illustrative; your own story supplies the subjects and relationships."
          : view === "motion"
            ? "Play a preview to see its choreography. These examples use illustrative copy and data; your reel keeps your own content and brand colours."
            : "Base layouts remain available for manual composition and longer or specialised content."}
      </p>
      <div
        className={
          view === "showpieces"
            ? "grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3"
            : LISTING_GRID_6_CARDS
        }
      >
        {view === "showpieces"
          ? SHOWPIECES.map((piece, index) => (
              <ShowpiecePreviewCard key={piece.id} index={index} />
            ))
          : view === "motion"
            ? MOTION_SAMPLES.map((scene, index) => (
                <MotionPreviewCard key={scene.id} index={index} />
              ))
            : TEMPLATES.map((t) => (
                <TemplatePreviewCard key={t.id} template={t} />
              ))}
      </div>
    </div>
  );
}
