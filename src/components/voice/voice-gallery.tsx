"use client";

import * as React from "react";
import { Loader2, Play, Square, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { sampleLine } from "@/components/voice/recommended-voices";
import { KOKORO_LANGUAGE_GROUPS } from "@/providers/voice/kokoro";
import {
  GALLERY_VOICES,
  filterGallery,
  galleryTones,
  languageSupport,
  type VoiceGender,
} from "@/providers/voice/voice-catalog";

const FAVOURITES_KEY = "reel-studio.favourite-voices";

const FAVOURITES_EVENT = "reel-studio:favourite-voices";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(FAVOURITES_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(FAVOURITES_EVENT, onChange);
  };
}

/** The raw stored text; a string is a stable snapshot for useSyncExternalStore. */
function snapshot(): string {
  try {
    return localStorage.getItem(FAVOURITES_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parseFavourites(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

/**
 * Every local voice in one place: filter by language, gender and tone, star the
 * ones you use, and hear a sample. A suggested voice is marked for each language.
 * Samples are made on this computer the first time and then play from the cache.
 */
export function VoiceGallery({
  onPick,
}: {
  onPick?: (voiceId: string) => void;
}) {
  const [language, setLanguage] = React.useState("");
  const [gender, setGender] = React.useState<"" | VoiceGender>("");
  const [tone, setTone] = React.useState("");
  const [onlyFavourites, setOnlyFavourites] = React.useState(false);
  const raw = React.useSyncExternalStore(subscribe, snapshot, () => "[]");
  const favourites = React.useMemo(() => parseFavourites(raw), [raw]);
  const [playing, setPlaying] = React.useState<string>();
  const [loading, setLoading] = React.useState<string>();
  const [error, setError] = React.useState<string>();
  const audio = React.useRef<HTMLAudioElement | null>(null);

  React.useEffect(() => () => audio.current?.pause(), []);

  function toggleFavourite(id: string) {
    const next = favourites.includes(id)
      ? favourites.filter((item) => item !== id)
      : [...favourites, id];
    try {
      localStorage.setItem(FAVOURITES_KEY, JSON.stringify(next));
    } catch {
      // Blocked storage: stars cannot be kept, the page still works.
    }
    window.dispatchEvent(new Event(FAVOURITES_EVENT));
  }

  async function toggleSample(id: string, name: string) {
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
          text: sampleLine(name),
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

  const voices = filterGallery(GALLERY_VOICES, {
    language: language || undefined,
    gender: gender || undefined,
    tone: tone || undefined,
    only: onlyFavourites ? favourites : undefined,
  });

  return (
    <Card className="space-y-4 p-4" data-testid="voice-gallery">
      <div>
        <h2 className="text-sm font-semibold">Voice gallery</h2>
        <p className="text-muted-foreground text-xs">
          All {GALLERY_VOICES.length} voices that run on this computer. Star the
          ones you use; they are remembered in this browser.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="grid gap-1">
          Language
          <NativeSelect
            aria-label="Language"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option value="">All languages</option>
            {KOKORO_LANGUAGE_GROUPS.map((group) => (
              <option key={group.id} value={group.id}>
                {group.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1">
          Voice
          <NativeSelect
            aria-label="Gender"
            value={gender}
            onChange={(event) =>
              setGender(event.target.value as "" | VoiceGender)
            }
          >
            <option value="">Any</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </NativeSelect>
        </label>
        <label className="grid gap-1">
          Tone
          <NativeSelect
            aria-label="Tone"
            value={tone}
            onChange={(event) => setTone(event.target.value)}
          >
            <option value="">Any</option>
            {galleryTones().map((word) => (
              <option key={word} value={word}>
                {word}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex items-center gap-2 pb-2">
          <input
            type="checkbox"
            checked={onlyFavourites}
            onChange={(event) => setOnlyFavourites(event.target.checked)}
          />
          Starred only
        </label>
      </div>
      {language && languageSupport(language) === "limited" && (
        <p role="note" className="text-muted-foreground text-xs">
          These voices speak this language, but this computer reads text with
          English pronunciation rules, so some words will sound off. The sample
          below is an English line, to hear the voice itself.
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
      <p className="text-muted-foreground text-xs" aria-live="polite">
        {voices.length} {voices.length === 1 ? "voice" : "voices"}
      </p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {voices.map((voice) => {
          const starred = favourites.includes(voice.id);
          return (
            <li
              key={voice.id}
              className="flex items-center gap-2 rounded-lg border p-2"
            >
              <Button
                variant="outline"
                size="icon"
                aria-label={`${playing === voice.id ? "Stop" : "Play a sample of"} ${voice.name}`}
                onClick={() => void toggleSample(voice.id, voice.name)}
              >
                {loading === voice.id ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : playing === voice.id ? (
                  <Square className="size-4" aria-hidden />
                ) : (
                  <Play className="size-4" aria-hidden />
                )}
              </Button>
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium">
                  {voice.name}
                  {voice.recommended && (
                    <span className="text-muted-foreground ml-1 text-xs font-normal">
                      · suggested
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {voice.languageLabel} · {voice.gender}
                  {voice.tone.length ? ` · ${voice.tone.join(", ")}` : ""}
                </p>
              </div>
              {onPick && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onPick(voice.id)}
                >
                  Use
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-pressed={starred}
                aria-label={`${starred ? "Remove the star from" : "Star"} ${voice.name}`}
                onClick={() => toggleFavourite(voice.id)}
              >
                <Star
                  className={`size-4 ${starred ? "fill-current" : ""}`}
                  aria-hidden
                />
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
