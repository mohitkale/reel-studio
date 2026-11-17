"use client";

import * as React from "react";
import { Loader2, Play, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  KOKORO_VOICES,
  RECOMMENDED_KOKORO_VOICES,
} from "@/providers/voice/kokoro";

/** About five seconds of speech, the same line for every voice. */
export function sampleLine(name: string): string {
  return `Hi, I am ${name}. This is how I narrate your videos.`;
}

const VOICES = RECOMMENDED_KOKORO_VOICES.map((id) =>
  KOKORO_VOICES.find((voice) => voice.id === id),
).filter((voice): voice is NonNullable<typeof voice> => Boolean(voice));

/**
 * The six voices worth trying first, each with a short sample, instead of all
 * 54. Samples are made once on this computer and then play from the cache.
 */
export function RecommendedVoices({
  onPick,
  selectedId,
}: {
  onPick?: (voiceId: string) => void;
  selectedId?: string;
}) {
  const audio = React.useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = React.useState<string>();
  const [loading, setLoading] = React.useState<string>();
  const [error, setError] = React.useState<string>();

  React.useEffect(() => () => audio.current?.pause(), []);

  async function toggle(id: string, label: string) {
    setError(undefined);
    if (playing === id) {
      audio.current?.pause();
      setPlaying(undefined);
      return;
    }
    audio.current?.pause();
    setLoading(id);
    try {
      const response = await fetch("/api/voice-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerId: "kokoro-server",
          voiceId: id,
          text: sampleLine(label.split(" — ")[0] ?? label),
        }),
      });
      const json = (await response.json()) as {
        audioUrl?: string;
        error?: string;
      };
      if (!response.ok || !json.audioUrl)
        throw new Error(json.error ?? `HTTP ${response.status}`);
      const next = new Audio(json.audioUrl);
      next.onended = () => setPlaying(undefined);
      audio.current = next;
      await next.play();
      setPlaying(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not play the sample");
    } finally {
      setLoading(undefined);
    }
  }

  return (
    <Card className="space-y-3 p-4" data-testid="recommended-voices">
      <div>
        <h2 className="text-sm font-semibold">Six voices to start with</h2>
        <p className="text-muted-foreground text-sm">
          Press play to hear each one. You can change the voice at any time.
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {VOICES.map((voice) => (
          <li
            key={voice.id}
            className="flex items-center justify-between gap-2 rounded-lg border p-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{voice.name}</p>
              <p className="text-muted-foreground text-xs">
                {voice.language}
                {voice.id === "af_heart" ? " · default" : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Button
                size="icon"
                variant="outline"
                aria-label={`${playing === voice.id ? "Stop" : "Play"} sample of ${voice.name}`}
                onClick={() => void toggle(voice.id, voice.name)}
              >
                {loading === voice.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : playing === voice.id ? (
                  <Square className="size-4" />
                ) : (
                  <Play className="size-4" />
                )}
              </Button>
              {onPick && (
                <Button
                  size="sm"
                  variant={selectedId === voice.id ? "default" : "outline"}
                  onClick={() => onPick(voice.id)}
                >
                  {selectedId === voice.id ? "Selected" : "Use"}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </Card>
  );
}
