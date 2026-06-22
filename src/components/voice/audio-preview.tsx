"use client";

import * as React from "react";
import { Loader2, Pause, Play, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";

// Coordinates playback so only one preview plays at a time.
const PLAY_EVENT = "reel-voice-preview-play";

/** Play/pause button for a voice sample. Uses previewUrl, so it spends no credits. */
export function AudioPreview({
  url,
  label,
}: {
  url?: string;
  label: string;
}) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [state, setState] = React.useState<"idle" | "loading" | "playing">(
    "idle",
  );
  const id = React.useId();

  React.useEffect(() => {
    function onOtherPlay(e: Event) {
      if ((e as CustomEvent<string>).detail !== id) {
        audioRef.current?.pause();
      }
    }
    window.addEventListener(PLAY_EVENT, onOtherPlay);
    return () => window.removeEventListener(PLAY_EVENT, onOtherPlay);
  }, [id]);

  if (!url) {
    return (
      <Button
        variant="ghost"
        size="icon"
        disabled
        aria-label="No preview available"
        title="No preview available"
      >
        <VolumeX />
      </Button>
    );
  }

  function toggle() {
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio(url);
      audio.addEventListener("ended", () => setState("idle"));
      audio.addEventListener("playing", () => setState("playing"));
      audio.addEventListener("pause", () => setState("idle"));
      audio.addEventListener("error", () => setState("idle"));
      audioRef.current = audio;
    }

    if (state === "playing") {
      audio.pause();
      return;
    }

    window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: id }));
    setState("loading");
    void audio.play().catch(() => setState("idle"));
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={
        state === "playing" ? `Pause ${label} preview` : `Play ${label} preview`
      }
    >
      {state === "loading" ? (
        <Loader2 className="animate-spin" />
      ) : state === "playing" ? (
        <Pause />
      ) : (
        <Play />
      )}
    </Button>
  );
}
