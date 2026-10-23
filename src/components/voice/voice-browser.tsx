"use client";

import * as React from "react";
import { toast } from "sonner";
import { Search, TriangleAlert, Mic, Star } from "lucide-react";

import type { ProviderId, VoiceSummary } from "@/providers/voice/types";
import { useVoices } from "@/hooks/voice";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { AudioPreview } from "@/components/voice/audio-preview";

const MINE: VoiceSummary["category"][] = ["cloned", "professional"];

function categoryLabel(category: VoiceSummary["category"]) {
  switch (category) {
    case "cloned":
      return "Cloned";
    case "professional":
      return "Professional";
    case "shared":
      return "Shared";
    default:
      return "Library";
  }
}

function VoiceRow({
  voice,
  favorite,
  toggle,
}: {
  voice: VoiceSummary;
  favorite: boolean;
  toggle(): void;
}) {
  return (
    <li className="bg-card flex items-center gap-3 rounded-lg border px-3 py-2.5">
      <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-md">
        <Mic className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{voice.name}</span>
          <Badge
            variant={voice.category === "cloned" ? "default" : "secondary"}
          >
            {categoryLabel(voice.category)}
          </Badge>
        </div>
        <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
          {voice.language ? <span>{voice.language}</span> : null}
          {voice.tags?.slice(0, 3).map((t) => (
            <span key={t} className="bg-muted rounded px-1.5 py-0.5">
              {t}
            </span>
          ))}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`${favorite ? "Unfavorite" : "Favorite"} ${voice.name}`}
        aria-pressed={favorite}
        onClick={toggle}
      >
        <Star className={favorite ? "text-primary fill-current" : ""} />
      </Button>
      <AudioPreview url={voice.previewUrl} label={voice.name} />
    </li>
  );
}

function VoiceList({
  voices,
  loading,
  emptyLabel,
  favorites,
  toggle,
}: {
  voices: VoiceSummary[];
  loading: boolean;
  emptyLabel: string;
  favorites: string[];
  toggle(id: string): void;
}) {
  if (loading) {
    return (
      <ul className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <li
            key={i}
            className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
          >
            <Skeleton className="size-9 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </li>
        ))}
      </ul>
    );
  }
  if (voices.length === 0) {
    return (
      <p className="text-muted-foreground px-1 py-8 text-center text-sm">
        {emptyLabel}
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {voices.map((v) => (
        <VoiceRow
          key={`${v.category}:${v.id}`}
          voice={v}
          favorite={favorites.includes(v.id)}
          toggle={() => toggle(v.id)}
        />
      ))}
    </ul>
  );
}

/** Browse a provider's voices: search, split into My voices / Library, preview inline. */
export function VoiceBrowser({
  providerId,
  configured,
}: {
  providerId: ProviderId;
  configured: boolean;
}) {
  const storageKey = `reel-studio:favorite-voices:${providerId}`;
  const subscribe = React.useCallback((notify: () => void) => {
    window.addEventListener("storage", notify);
    window.addEventListener("reel-voice-favorites", notify);
    return () => {
      window.removeEventListener("storage", notify);
      window.removeEventListener("reel-voice-favorites", notify);
    };
  }, []);
  const stored = React.useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(storageKey) ?? "[]";
      } catch {
        return "[]";
      }
    },
    () => "[]",
  );
  const favorites = React.useMemo(() => {
    try {
      const value: unknown = JSON.parse(stored);
      return Array.isArray(value)
        ? value.filter((id): id is string => typeof id === "string")
        : [];
    } catch {
      return [];
    }
  }, [stored]);
  function toggle(id: string) {
    const next = favorites.includes(id)
      ? favorites.filter((value) => value !== id)
      : [...favorites, id];
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      window.dispatchEvent(new Event("reel-voice-favorites"));
    } catch {
      toast.error("Favorites could not be saved in this browser");
    }
  }
  const [category, setCategory] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const debounced = useDebouncedValue(query, 300);
  const { data, isLoading, isError, error } = useVoices(
    configured ? providerId : undefined,
    debounced,
  );

  if (!configured) {
    const description =
      providerId === "voiceforge"
        ? "Set VOICEFORGE_SERVICE_URL in .env.local and run VoiceForge locally."
        : "Once a key is saved above, your default and cloned voices appear here.";
    return (
      <EmptyState
        icon={Mic}
        title={
          providerId === "voiceforge"
            ? "VoiceForge not configured"
            : "Add an API key to browse voices"
        }
        description={description}
      />
    );
  }

  if (isError) {
    return (
      <div className="border-destructive/40 bg-destructive/10 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm">
        <TriangleAlert className="text-destructive mt-0.5 size-4 shrink-0" />
        <div>
          <p className="text-destructive font-medium">Could not load voices</p>
          <p className="text-muted-foreground">
            {(error as Error)?.message ?? "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  const voices = data ?? [];
  const mine = voices.filter((v) => MINE.includes(v.category));
  const library = voices.filter((v) => !MINE.includes(v.category));

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search voices by name"
          className="pl-9"
          aria-label="Search voices"
        />
      </div>

      <Tabs value={category ?? "library"} onValueChange={setCategory}>
        <TabsList>
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
          <TabsTrigger value="mine">
            My voices
            <span className={cn("text-muted-foreground ml-1 text-xs")}>
              {isLoading ? "" : mine.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="library">
            Library
            <span className="text-muted-foreground ml-1 text-xs">
              {isLoading ? "" : library.length}
            </span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="favorites">
          <VoiceList
            voices={voices.filter((v) => favorites.includes(v.id))}
            loading={isLoading}
            emptyLabel="Star voices to find them quickly here."
            favorites={favorites}
            toggle={toggle}
          />
        </TabsContent>
        <TabsContent value="mine">
          <VoiceList
            favorites={favorites}
            toggle={toggle}
            voices={mine}
            loading={isLoading}
            emptyLabel="No cloned or professional voices found for this account."
          />
        </TabsContent>
        <TabsContent value="library">
          <VoiceList
            favorites={favorites}
            toggle={toggle}
            voices={library}
            loading={isLoading}
            emptyLabel="No library voices matched your search."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
