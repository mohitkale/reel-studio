"use client";
import * as React from "react";
import { SHOWPIECES } from "@/video/semantic-graphic";
import { SHOWPIECE_SAMPLES } from "@/video/showpiece-samples";
import { Card } from "@/components/ui/card";
import { HyperFramesPlayer } from "./hyperframes-player";
import {
  applyVisualTheme,
  VISUAL_THEMES,
} from "@/production/creative-direction";
import { defaultBrandTokens } from "@/video/tokens";
import { buildAutomaticSfxCues } from "@/lib/sfx-planner";
import { resolveReelSfxCues } from "@/lib/sfx-cues";

export function ShowpiecePreviewCard({ index }: { index: number }) {
  const piece = SHOWPIECES[index],
    scene = SHOWPIECE_SAMPLES[index];
  const ref = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "100px" },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const timeline = React.useMemo(
    () => [{ sceneId: scene.id, startFrame: 0, durationFrames: 240 }],
    [scene.id],
  );
  const sfxCues = React.useMemo(() => {
    const dto = {
      ...scene,
      scriptId: "illustrative-gallery",
      spokenText: scene.spokenText ?? null,
      order: index,
      hideText: null,
      selectedVoiceClipId: null,
    };
    return resolveReelSfxCues({
      sfxEnabled: true,
      sfxJson: JSON.stringify({
        enabled: true,
        cues: buildAutomaticSfxCues([dto]),
      }),
      scenes: [dto],
      timeline,
      fps: 30,
      videoEngine: "hyperframes",
    });
  }, [scene, index, timeline]);
  return (
    <Card className="overflow-hidden">
      <div ref={ref} style={{ aspectRatio: "1080 / 1920" }}>
        {visible ? (
          <HyperFramesPlayer
            scenes={[scene]}
            timeline={timeline}
            totalFrames={240}
            fps={30}
            loop
            tokens={applyVisualTheme(
              defaultBrandTokens,
              index === 4 ? VISUAL_THEMES.paper : VISUAL_THEMES.circuit,
            )}
            sfxCues={sfxCues}
          />
        ) : (
          <div className="bg-muted/40 text-muted-foreground flex h-full items-center justify-center text-xs">
            Scroll to preview
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <h3 className="text-sm font-semibold">{piece.name}</h3>
        <p className="text-muted-foreground text-xs">{piece.description}</p>
        <p className="text-muted-foreground text-xs">
          Play to hear sound accents. AI selects this from the story; no motion
          settings needed.
        </p>
      </div>
    </Card>
  );
}
