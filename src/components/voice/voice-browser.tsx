"use client";

import * as React from "react";
import { Search, TriangleAlert, Mic } from "lucide-react";

import type { ProviderId, VoiceSummary } from "@/providers/voice/types";
import { useVoices } from "@/hooks/voice";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
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

function VoiceRow({ voice }: { voice: VoiceSummary }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Mic className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{voice.name}</span>
          <Badge variant={voice.category === "cloned" ? "default" : "secondary"}>
            {categoryLabel(voice.category)}
          </Badge>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {voice.language ? <span>{voice.language}</span> : null}
          {voice.tags?.slice(0, 3).map((t) => (
            <span key={t} className="rounded bg-muted px-1.5 py-0.5">
              {t}
            </span>
          ))}
        </div>
      </div>
      <AudioPreview url={voice.previewUrl} label={voice.name} />
    </li>
  );
}

function VoiceList({
  voices,
  loading,
  emptyLabel,
}: {
  voices: VoiceSummary[];
  loading: boolean;
  emptyLabel: string;
}) {
  if (loading) {
    return (
      <ul className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
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
      <p className="px-1 py-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {voices.map((v) => (
        <VoiceRow key={`${v.category}:${v.id}`} voice={v} />
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
  const [query, setQuery] = React.useState("");
  const debounced = useDebouncedValue(query, 300);
  const { data, isLoading, isError, error } = useVoices(
    configured ? providerId : undefined,
    debounced,
  );

  if (!configured) {
    return (
      <EmptyState
        icon={Mic}
        title="Add an API key to browse voices"
        description="Once a key is saved above, your default and cloned voices appear here."
      />
    );
  }

  if (isError) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div>
          <p className="font-medium text-destructive">Could not load voices</p>
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
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search voices by name"
          className="pl-9"
          aria-label="Search voices"
        />
      </div>

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">
            My voices
            <span className={cn("ml-1 text-xs text-muted-foreground")}>
              {isLoading ? "" : mine.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="library">
            Library
            <span className="ml-1 text-xs text-muted-foreground">
              {isLoading ? "" : library.length}
            </span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="mine">
          <VoiceList
            voices={mine}
            loading={isLoading}
            emptyLabel="No cloned or professional voices found for this account."
          />
        </TabsContent>
        <TabsContent value="library">
          <VoiceList
            voices={library}
            loading={isLoading}
            emptyLabel="No library voices matched your search."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
