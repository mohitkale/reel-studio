"use client";

import * as React from "react";
import { Music, Loader2, Trash2, Upload, Search, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { useAssets, useUploadAsset } from "@/hooks/assets";
import { useSetScriptMusic } from "@/hooks/script";
import { useSearchMusic } from "@/hooks/music";
import { MUSIC_LIBRARY, suggestBundledTrack } from "@/lib/music-library";
import type { SceneDTO } from "@/lib/dto";
import type { RemoteMusicTrack } from "@/providers/music/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { HintTooltip } from "@/components/ui/hint-tooltip";

/** Most common truthy value in a list, or undefined if there isn't one. */
function mostCommon<T>(values: (T | undefined)[]): T | undefined {
  const counts = new Map<T, number>();
  for (const v of values) {
    if (v === undefined) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best: T | undefined;
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

function RemoteTrackRow({
  track,
  active,
  onUse,
}: {
  track: RemoteMusicTrack;
  active: boolean;
  onUse: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2",
        active ? "border-primary ring-1 ring-primary" : "border-border",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{track.name}</div>
        <div className="truncate text-xs text-muted-foreground">{track.attribution}</div>
      </div>
      <audio controls preload="none" src={track.url} className="h-8 w-32" />
      <Button size="sm" variant={active ? "default" : "outline"} onClick={onUse}>
        Use
      </Button>
    </div>
  );
}

/**
 * Attach a background music track to the reel. It is mixed under the voiceover
 * and automatically ducked while a scene is being spoken. Upload your own audio
 * (you are responsible for its licensing).
 */
export function MusicControl({
  scriptId,
  musicUrl,
  musicVolume,
  scenes = [],
}: {
  scriptId: string;
  musicUrl: string | null;
  musicVolume: number;
  /** Used to auto-suggest a track from the AI's per-scene mood/musicMood hints. */
  scenes?: SceneDTO[];
}) {
  const [open, setOpen] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const setMusic = useSetScriptMusic(scriptId);
  const uploadAsset = useUploadAsset();
  const { data: audioAssets } = useAssets("audio");
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  const dominantMood = React.useMemo(
    () => mostCommon(scenes.map((s) => s.mood)),
    [scenes],
  );
  const dominantMusicMood = React.useMemo(
    () => mostCommon(scenes.map((s) => s.musicMood?.trim().toLowerCase())),
    [scenes],
  );
  const suggestedTrack = React.useMemo(
    () => suggestBundledTrack(dominantMood),
    [dominantMood],
  );

  const suggestionQuery = open && !musicUrl ? dominantMusicMood : undefined;
  const suggestionSearch = useSearchMusic(suggestionQuery ?? "", Boolean(suggestionQuery));
  const manualSearch = useSearchMusic(searchQuery, open && searchQuery.length > 1);

  // Make the preview reflect the chosen level so you can hear the impact before
  // committing. (In the actual video the music is ducked further under narration.)
  const previewVolume = Math.max(0, Math.min(1, musicVolume / 100));
  React.useEffect(() => {
    if (audioRef.current) audioRef.current.volume = previewVolume;
  }, [previewVolume, musicUrl]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", "audio");
    try {
      const asset = await uploadAsset.mutateAsync(fd);
      setMusic.mutate({ musicUrl: asset.url });
    } catch {
      toast.error("Failed to upload audio");
    }
  }

  const busy = uploadAsset.isPending || setMusic.isPending;

  return (
    <>
      <HintTooltip
        label="Add background music — ducked under the voiceover while scenes are spoken"
        side="bottom"
      >
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Music className="size-3.5" />
        Music
        {musicUrl && (
          <span className="ml-1 size-1.5 rounded-full bg-primary" aria-hidden />
        )}
      </Button>
      </HintTooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Background music</DialogTitle>
            <DialogDescription>
              Mixed under the voiceover and automatically ducked while a scene is
              spoken, so narration stays clear. Upload audio you have the rights
              to use.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="justify-start"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                Upload track
              </Button>
              {musicUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="justify-start text-muted-foreground hover:text-destructive"
                  disabled={busy}
                  onClick={() => setMusic.mutate({ musicUrl: null })}
                >
                  <Trash2 className="size-3.5" />
                  Remove
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleUpload}
              />
            </div>

            {musicUrl && (
              <audio
                ref={audioRef}
                className="w-full"
                controls
                preload="metadata"
                src={musicUrl}
                onLoadedMetadata={(e) => {
                  (e.currentTarget as HTMLAudioElement).volume = previewVolume;
                }}
              />
            )}

            {!musicUrl && (suggestedTrack || dominantMusicMood) && (
              <div className="grid gap-1.5 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-2.5">
                <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Wand2 className="size-3.5" />
                  Suggested for this video{dominantMusicMood ? ` — "${dominantMusicMood}"` : ""}
                </Label>
                {suggestedTrack && (
                  <button
                    type="button"
                    onClick={() => setMusic.mutate({ musicUrl: suggestedTrack.url })}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors hover:bg-accent"
                  >
                    <div className="text-sm font-medium">{suggestedTrack.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {suggestedTrack.description}
                    </div>
                  </button>
                )}
                {suggestionSearch.data?.tracks?.[0] && (
                  <RemoteTrackRow
                    track={suggestionSearch.data.tracks[0]}
                    active={musicUrl === suggestionSearch.data.tracks[0].url}
                    onUse={() =>
                      setMusic.mutate({ musicUrl: suggestionSearch.data!.tracks[0].url })
                    }
                  />
                )}
              </div>
            )}

            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">
                Starter tracks (free, CC0)
              </Label>
              <div className="grid gap-1">
                {MUSIC_LIBRARY.map((track) => (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => setMusic.mutate({ musicUrl: track.url })}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left transition-colors",
                      musicUrl === track.url
                        ? "border-primary ring-1 ring-primary"
                        : "border-border hover:bg-accent",
                    )}
                  >
                    <div className="text-sm font-medium">{track.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {track.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">
                Search a bigger library (Jamendo)
              </Label>
              <div className="flex gap-2">
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setSearchQuery(searchInput)}
                  placeholder="e.g. upbeat lo-fi, tense cinematic..."
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSearchQuery(searchInput)}
                  disabled={!searchInput.trim()}
                >
                  <Search className="size-3.5" />
                  Search
                </Button>
              </div>
              {manualSearch.isFetching && (
                <p className="text-xs text-muted-foreground">Searching...</p>
              )}
              {manualSearch.data?.configured === false && searchQuery && (
                <p className="text-xs text-muted-foreground">
                  Add a free Jamendo Client ID in Settings to search online tracks.
                </p>
              )}
              {manualSearch.data?.tracks && manualSearch.data.tracks.length > 0 && (
                <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
                  {manualSearch.data.tracks.map((track) => (
                    <RemoteTrackRow
                      key={track.id}
                      track={track}
                      active={musicUrl === track.url}
                      onUse={() => setMusic.mutate({ musicUrl: track.url })}
                    />
                  ))}
                </div>
              )}
              {manualSearch.data?.configured &&
                manualSearch.data.tracks.length === 0 &&
                !manualSearch.isFetching &&
                searchQuery && (
                  <p className="text-xs text-muted-foreground">No tracks found. Try different words.</p>
                )}
            </div>

            <div className="grid gap-1.5">
              <Label className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Music volume</span>
                <span>{musicVolume}%</span>
              </Label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={musicVolume}
                disabled={!musicUrl}
                onChange={(e) =>
                  setMusic.mutate({ musicVolume: Number(e.target.value) })
                }
              />
              <p className="text-[11px] text-muted-foreground">
                The preview above plays at this level. In the video the music is
                automatically ducked lower while a scene is being spoken.
              </p>
            </div>

            {audioAssets && audioAssets.length > 0 && (
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Pick from uploads
                </Label>
                <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border p-1">
                  {audioAssets.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      title={asset.name ?? asset.url}
                      onClick={() => setMusic.mutate({ musicUrl: asset.url })}
                      className={cn(
                        "truncate rounded px-2 py-1.5 text-left text-sm transition-colors",
                        musicUrl === asset.url
                          ? "bg-secondary text-secondary-foreground"
                          : "hover:bg-accent",
                      )}
                    >
                      {asset.name ?? asset.url.split("/").pop()}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
