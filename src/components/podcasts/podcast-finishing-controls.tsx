"use client";

import * as React from "react";
import { Loader2, Music2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import type { PodcastDTO } from "@/lib/dto";
import {
  PODCAST_BUMPER_SECONDS,
  type PodcastPronunciation,
} from "@/library/podcast-schemas";
import { useAssets, useUploadAsset } from "@/hooks/assets";
import { useUpdatePodcast } from "@/hooks/podcasts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";

export function PodcastFinishingControls({ podcast }: { podcast: PodcastDTO }) {
  const update = useUpdatePodcast(podcast.id);
  const upload = useUploadAsset();
  const { data: assets = [] } = useAssets("audio");
  const [rules, setRules] = React.useState<PodcastPronunciation[]>(
    podcast.pronunciations,
  );
  const options = [
    { value: "", label: "No bumper" },
    ...assets.map((asset) => ({
      value: asset.id,
      label: asset.name || "Uploaded audio",
    })),
  ];

  async function assign(
    field: "introMusicAssetId" | "outroMusicAssetId",
    assetId: string,
  ) {
    try {
      await update.mutateAsync({ [field]: assetId || null });
      toast.success("Podcast finishing saved");
    } catch (error) {
      toast.error("Could not assign audio", {
        description: (error as Error).message,
      });
    }
  }

  async function uploadAndAssign(
    field: "introMusicAssetId" | "outroMusicAssetId",
    file: File,
  ) {
    const form = new FormData();
    form.set("file", file);
    form.set("name", file.name);
    try {
      const asset = await upload.mutateAsync(form);
      await assign(field, asset.id);
    } catch (error) {
      toast.error("Could not upload audio", {
        description: (error as Error).message,
      });
    }
  }

  async function saveRules() {
    try {
      await update.mutateAsync({ pronunciations: rules });
      toast.success("Pronunciations saved");
    } catch (error) {
      toast.error("Could not save pronunciations", {
        description: (error as Error).message,
      });
    }
  }

  const busy = update.isPending || upload.isPending;
  return (
    <section className="border-border bg-card grid gap-4 rounded-xl border p-4 shadow-sm">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Music2 className="size-4" /> Podcast finishing
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          Opening and closing audio use a faded {PODCAST_BUMPER_SECONDS}-second
          excerpt. Pronunciations change provider-bound speech while keeping the
          written transcript intact.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(
          [
            ["introMusicAssetId", "Intro music", podcast.introMusicAssetId],
            ["outroMusicAssetId", "Outro music", podcast.outroMusicAssetId],
          ] as const
        ).map(([field, label, value]) => (
          <div key={field} className="grid gap-1.5">
            <Label>{label}</Label>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <Combobox
                  value={value ?? ""}
                  onChange={(next) => void assign(field, next)}
                  options={options}
                  placeholder="Choose uploaded audio"
                />
              </div>
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={busy}
                asChild
              >
                <label
                  className="cursor-pointer"
                  title={`Upload ${label.toLowerCase()}`}
                >
                  {upload.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  <input
                    type="file"
                    accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg"
                    className="sr-only"
                    disabled={busy}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadAndAssign(field, file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <Label>Pronunciation substitutions</Label>
            <p className="text-muted-foreground text-[11px]">
              Applied in order. Only a changed spoken result invalidates that
              turn&apos;s cached voice.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setRules((current) => [
                ...current,
                { find: "", replaceWith: "", caseSensitive: false },
              ])
            }
          >
            <Plus className="size-3.5" /> Add rule
          </Button>
        </div>
        {rules.map((rule, index) => (
          <div
            key={index}
            className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]"
          >
            <Input
              value={rule.find}
              placeholder="Written text"
              aria-label={`Pronunciation ${index + 1} written text`}
              onChange={(event) =>
                setRules((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, find: event.target.value }
                      : item,
                  ),
                )
              }
            />
            <Input
              value={rule.replaceWith}
              placeholder="Speak as"
              aria-label={`Pronunciation ${index + 1} spoken text`}
              onChange={(event) =>
                setRules((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, replaceWith: event.target.value }
                      : item,
                  ),
                )
              }
            />
            <label className="text-muted-foreground flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={rule.caseSensitive}
                onChange={(event) =>
                  setRules((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, caseSensitive: event.target.checked }
                        : item,
                    ),
                  )
                }
              />
              Match case
            </label>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Remove pronunciation ${index + 1}`}
              onClick={() =>
                setRules((current) =>
                  current.filter((_, itemIndex) => itemIndex !== index),
                )
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          className="w-fit"
          disabled={
            busy ||
            rules.some((rule) => !rule.find.trim() || !rule.replaceWith.trim())
          }
          onClick={() => void saveRules()}
        >
          Save pronunciation rules
        </Button>
      </div>
    </section>
  );
}
