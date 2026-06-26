"use client";

import * as React from "react";
import { Music, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { useAssets, useUploadAsset } from "@/hooks/assets";
import { useSetScriptMusic } from "@/hooks/script";
import { MUSIC_LIBRARY } from "@/lib/music-library";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

/**
 * Attach a background music track to the reel. It is mixed under the voiceover
 * and automatically ducked while a scene is being spoken. Upload your own audio
 * (you are responsible for its licensing).
 */
export function MusicControl({
  scriptId,
  musicUrl,
  musicVolume,
}: {
  scriptId: string;
  musicUrl: string | null;
  musicVolume: number;
}) {
  const [open, setOpen] = React.useState(false);
  const setMusic = useSetScriptMusic(scriptId);
  const uploadAsset = useUploadAsset();
  const { data: audioAssets } = useAssets("audio");
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const audioRef = React.useRef<HTMLAudioElement>(null);

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
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Music className="size-3.5" />
        Music
        {musicUrl && (
          <span className="ml-1 size-1.5 rounded-full bg-primary" aria-hidden />
        )}
      </Button>

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
