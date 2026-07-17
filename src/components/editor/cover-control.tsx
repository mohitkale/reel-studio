"use client";

import * as React from "react";
import { Image as ImageIcon, Loader2, Trash2, ImagePlus } from "lucide-react";
import { toast } from "sonner";

import { useAssets, useUploadAsset } from "@/hooks/assets";
import { useSetScriptCover } from "@/hooks/script";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { AssetThumbPicker } from "@/components/assets/asset-thumb-picker";

/**
 * Sets the reel's cover image — baked as the opening (thumbnail) frame of the
 * rendered MP4, so platforms that auto-pick the first frame use it as the poster.
 */
export function CoverControl({
  scriptId,
  coverUrl,
}: {
  scriptId: string;
  coverUrl: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const setCover = useSetScriptCover(scriptId);
  const uploadAsset = useUploadAsset();
  const { data: imageAssets } = useAssets("image");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", "image");
    try {
      const asset = await uploadAsset.mutateAsync(fd);
      setCover.mutate(asset.url);
    } catch {
      toast.error("Failed to upload cover");
    }
  }

  const busy = uploadAsset.isPending || setCover.isPending;

  return (
    <>
      <HintTooltip label="Set the opening thumbnail frame baked into the rendered MP4" side="bottom">
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <ImageIcon className="size-3.5" />
        Cover
        {coverUrl && <span className="ml-1 size-1.5 rounded-full bg-primary" aria-hidden />}
      </Button>
      </HintTooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reel cover</DialogTitle>
            <DialogDescription>
              Shown as the first frame of the rendered video — a baked-in thumbnail
              for platforms that don&apos;t let you upload one separately. For an
              edge-to-edge cover, use a vertical 9:16 image (1080×1920). Other
              sizes are shown in full, centered on the brand background.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3">
            <div className="relative w-28 shrink-0 overflow-hidden rounded-lg border bg-black" style={{ aspectRatio: "9/16" }}>
              {coverUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={coverUrl} alt="Cover" className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full items-center justify-center text-center text-[11px] text-muted-foreground">
                  No cover
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-2">
              <Button
                size="sm"
                variant="outline"
                className="justify-start"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
                Upload image
              </Button>
              {coverUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="justify-start text-muted-foreground hover:text-destructive"
                  disabled={busy}
                  onClick={() => setCover.mutate(null)}
                >
                  <Trash2 className="size-3.5" />
                  Remove cover
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUpload}
              />
            </div>
          </div>

          {imageAssets && imageAssets.length > 0 && (
            <AssetThumbPicker
              assets={imageAssets}
              selectedUrl={coverUrl}
              kind="image"
              aspect="portrait"
              onSelect={(url) => setCover.mutate(url)}
            />
          )}

          <DialogFooter>
            <Button size="sm" onClick={() => setOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
