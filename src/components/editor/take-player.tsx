"use client";

import * as React from "react";
import { Pause, Play } from "lucide-react";

import type { VoiceTakeDTO } from "@/lib/dto";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function fmt(seconds: number) {
  if (!isFinite(seconds)) seconds = 0;
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  const m = Math.floor(seconds / 60);
  return `${m}:${s}`;
}

/**
 * Plays a take and visualizes its beats on a timeline. The active beat (derived
 * from playback position via per-beat frame timing) is highlighted and reported
 * upward so the preview can show the matching scene - this is the caption sync.
 */
export function TakePlayer({
  take,
  onActiveSceneChange,
}: {
  take: VoiceTakeDTO;
  onActiveSceneChange?: (sceneId: string | null) => void;
}) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const [frame, setFrame] = React.useState(0);

  const totalFrames = Math.max(1, take.totalFrames);
  const totalSeconds = take.totalFrames / take.fps;

  const activeIndex = React.useMemo(() => {
    let idx = -1;
    take.timeline.forEach((b, i) => {
      if (frame >= b.startFrame) idx = i;
    });
    // If we are past the end of a beat and into a gap, still show the last one.
    return idx;
  }, [frame, take.timeline]);

  function report(playingNow: boolean, idx: number) {
    onActiveSceneChange?.(
      playingNow && idx >= 0 ? take.timeline[idx].sceneId : null,
    );
  }

  function onTimeUpdate() {
    const audio = audioRef.current;
    if (!audio) return;
    const f = Math.round(audio.currentTime * take.fps);
    setFrame(f);
    let idx = -1;
    take.timeline.forEach((b, i) => {
      if (f >= b.startFrame) idx = i;
    });
    report(true, idx);
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else void audio.play().catch(() => setPlaying(false));
  }

  function seekToBeat(startFrame: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = startFrame / take.fps;
    setFrame(startFrame);
  }

  return (
    <div className="space-y-2">
      <audio
        ref={audioRef}
        src={take.audioUrl}
        preload="metadata"
        onTimeUpdate={onTimeUpdate}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false);
          onActiveSceneChange?.(null);
        }}
        onEnded={() => {
          setPlaying(false);
          setFrame(0);
          onActiveSceneChange?.(null);
        }}
      />

      <div className="flex items-center gap-3">
        <Button size="icon" variant="secondary" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause /> : <Play />}
        </Button>

        <div className="flex-1">
          <div className="flex h-6 w-full items-stretch gap-0.5 overflow-hidden rounded-md bg-muted">
            {take.timeline.map((b, i) => (
              <button
                key={b.sceneId}
                type="button"
                title={`Scene ${i + 1}`}
                onClick={() => seekToBeat(b.startFrame)}
                className={cn(
                  "h-full rounded-[3px] transition-colors",
                  i === activeIndex
                    ? "bg-primary"
                    : "bg-primary/30 hover:bg-primary/50",
                )}
                style={{
                  width: `${(b.durationFrames / totalFrames) * 100}%`,
                }}
              />
            ))}
          </div>
        </div>

        <span className="w-20 text-right font-mono text-xs text-muted-foreground">
          {fmt(frame / take.fps)} / {fmt(totalSeconds)}
        </span>
      </div>
    </div>
  );
}
