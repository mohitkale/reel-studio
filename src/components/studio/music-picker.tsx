"use client";

import * as React from "react";
import { Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { MUSIC_LIBRARY } from "@/lib/music-library";

/**
 * Choose the background music for one video, with a preview. "Automatic" lets
 * the theme pick; any of the bundled tracks can be chosen by name.
 */
export function MusicPicker({
  value,
  onChange,
}: {
  /** "auto" or a bundled track id. */
  value: string;
  onChange: (value: string) => void;
}) {
  const audio = React.useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const track = MUSIC_LIBRARY.find((t) => t.id === value);

  React.useEffect(
    () => () => {
      audio.current?.pause();
    },
    [],
  );

  function toggle() {
    if (!track) return;
    if (playing) {
      audio.current?.pause();
      setPlaying(false);
      return;
    }
    audio.current?.pause();
    const next = new Audio(track.url);
    next.onended = () => setPlaying(false);
    audio.current = next;
    void next.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <label htmlFor="music-track" className="text-sm">
        Music
      </label>
      <NativeSelect
        id="music-track"
        className="w-56"
        value={value}
        onChange={(event) => {
          audio.current?.pause();
          setPlaying(false);
          onChange(event.target.value);
        }}
      >
        <option value="auto">Automatic (fits the look)</option>
        {MUSIC_LIBRARY.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} · {t.energy} energy · {t.bpm} bpm
          </option>
        ))}
      </NativeSelect>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!track}
        onClick={toggle}
        aria-label={playing ? "Stop the preview" : "Play a preview"}
      >
        {playing ? (
          <Pause className="size-4" aria-hidden />
        ) : (
          <Play className="size-4" aria-hidden />
        )}
        Preview
      </Button>
      {track && (
        <span className="text-muted-foreground text-xs">
          {track.description}
        </span>
      )}
    </div>
  );
}
