"use client";

import * as React from "react";

import { HyperFramesPlayer } from "@/components/editor/hyperframes-player";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  sceneLibrary,
  type SceneLibraryEntry,
} from "@/engines/hyperframes/scenes/library";
import { dimsFor, type Orientation } from "@/lib/orientation";

const FORMATS: Array<{
  id: "9:16" | "16:9" | "1:1";
  orientation: Orientation;
}> = [
  { id: "9:16", orientation: "portrait" },
  { id: "16:9", orientation: "landscape" },
  { id: "1:1", orientation: "square" },
];
const PREVIEW_FRAMES = 90;

function SceneCard({
  entry,
  format,
}: {
  entry: SceneLibraryEntry;
  format: (typeof FORMATS)[number];
}) {
  const { width, height } = dimsFor(format.orientation);
  const ref = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([item]) => setVisible(item?.isIntersecting ?? false),
      { rootMargin: "200px 0px", threshold: 0.01 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const timeline = React.useMemo(
    () => [
      {
        sceneId: entry.scene.id,
        startFrame: 0,
        durationFrames: PREVIEW_FRAMES,
      },
    ],
    [entry.scene.id],
  );
  return (
    <Card className="overflow-hidden" data-scene-type={entry.type}>
      <div ref={ref} style={{ aspectRatio: `${width} / ${height}` }}>
        {visible ? (
          <HyperFramesPlayer
            key={`${entry.type}-${format.id}`}
            scenes={[entry.scene]}
            timeline={timeline}
            totalFrames={PREVIEW_FRAMES}
            fps={30}
            width={width}
            height={height}
            loop
          />
        ) : (
          <div className="bg-muted/40 text-muted-foreground flex h-full items-center justify-center text-xs">
            Scroll to preview
          </div>
        )}
      </div>
      <div className="space-y-1 p-4">
        <h3 className="text-sm font-semibold">{entry.name}</h3>
        <p className="text-muted-foreground font-mono text-xs">{entry.type}</p>
        <p className="text-muted-foreground text-xs">{entry.description}</p>
        {entry.layout ? (
          <p className="text-muted-foreground/80 text-xs">
            {entry.layout[format.id]}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

export default function ScenesPage() {
  const [format, setFormat] = React.useState(FORMATS[0]!);
  const entries = React.useMemo(() => sceneLibrary(), []);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Scene types"
        description="Every scene type a storyboard can use, rendered with sample content. Pick a format to see how each one fills the frame."
      />
      <div className="flex gap-2" role="group" aria-label="Format">
        {FORMATS.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={item.id === format.id ? "default" : "outline"}
            onClick={() => setFormat(item)}
          >
            {item.id}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {entries.map((entry) => (
          <SceneCard key={entry.type} entry={entry} format={format} />
        ))}
      </div>
    </div>
  );
}
