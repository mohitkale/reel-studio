"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, WandSparkles } from "lucide-react";
import { useGenerateProject } from "@/hooks/ai";
import {
  PRODUCTION_PRESETS,
  type ProductionPresetId,
} from "@/production/presets";
import {
  ORIENTATIONS,
  ORIENTATION_LABELS,
  type Orientation,
} from "@/lib/orientation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

export function PromptCreator({
  initialBrief = "",
  initialPresetId = "editorial-explainer",
}: {
  initialBrief?: string;
  initialPresetId?: ProductionPresetId;
}) {
  const router = useRouter();
  const generate = useGenerateProject();
  const [brief, setBrief] = React.useState(initialBrief);
  const [preset, setPreset] = React.useState(initialPresetId);
  const [orientation, setOrientation] = React.useState<Orientation>("portrait");
  const [voice, setVoice] = React.useState(false);
  const valid = brief.trim().length >= 3 && brief.trim().length <= 8000;
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || generate.isPending) return;
    generate.mutate(
      {
        mode: "story",
        brief: brief.trim(),
        productionPresetId: preset,
        orientation,
        mediaPreference: "none",
        directorBudget: { maxPaidCalls: 0 },
        idempotencyKey: `prompt-create:${crypto.randomUUID()}`,
        quickProduce: {
          enabled: true,
          planner: "deterministic",
          mediaPreference: "none",
          voice: {
            enabled: voice,
            providerId: "kokoro-server",
            voiceId: "af_heart",
          },
        },
      },
      {
        onSuccess: ({ job, scriptId }) =>
          router.push(job ? `/results/${job.id}` : `/editor/${scriptId}`),
      },
    );
  }
  return (
    <form
      onSubmit={submit}
      className="bg-card rounded-2xl border p-4 shadow-sm sm:p-6"
      aria-label="Create a video"
    >
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          What would you like to make?
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Paste your script or a few clear ideas. Choose a look and generate a
          video you can download and edit.
        </p>
      </div>
      <Label htmlFor="video-prompt">Your text</Label>
      <Textarea
        id="video-prompt"
        value={brief}
        onChange={(event) => setBrief(event.target.value)}
        placeholder="A useful idea. A clear example. One next step."
        maxLength={8000}
        rows={4}
        className="mt-2 min-h-28 resize-y text-base"
        disabled={generate.isPending}
      />
      <fieldset className="mt-5" disabled={generate.isPending}>
        <legend className="text-sm font-medium">Choose a look</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 min-[360px]:grid-cols-3 xl:grid-cols-6">
          {PRODUCTION_PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={preset === item.id}
              onClick={() => setPreset(item.id)}
              className={cn(
                "focus-visible:outline-primary overflow-hidden rounded-lg border text-left transition-colors focus-visible:outline-2",
                preset === item.id
                  ? "border-primary ring-primary ring-1"
                  : "hover:border-primary/50",
              )}
            >
              {/* Generated from the same composition compiler as the exported presets. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/preset-previews/${item.id}.png`}
                alt=""
                className="aspect-video w-full object-cover"
              />
              <span className="block px-2 py-2 text-xs font-medium">
                {item.name}
              </span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="video-format">Format</Label>
          <NativeSelect
            id="video-format"
            value={orientation}
            onChange={(event) =>
              setOrientation(event.target.value as Orientation)
            }
            disabled={generate.isPending}
          >
            {ORIENTATIONS.map((item) => (
              <option key={item} value={item}>
                {ORIENTATION_LABELS[item]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button
          type="submit"
          disabled={!valid || generate.isPending}
          className="min-w-36"
        >
          {generate.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <WandSparkles className="size-4" />
          )}
          {generate.isPending ? "Generating…" : "Generate"}
        </Button>
      </div>
      <p className="text-muted-foreground mt-3 text-xs">
        No AI key required. Uses your supplied text with animated backgrounds.
        Narration is off by default.
      </p>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-medium">
          Narration options
        </summary>
        <label className="mt-2 flex items-center gap-2">
          <input
            type="checkbox"
            checked={voice}
            onChange={(event) => setVoice(event.target.checked)}
            disabled={generate.isPending}
          />{" "}
          Add local narration using the configured local Kokoro voice
        </label>
        <p className="text-muted-foreground mt-1 text-xs">
          Voice setup is available in Settings. You can also add or change
          narration later in the editor.
        </p>
      </details>
      {generate.isError && (
        <p role="alert" className="text-destructive mt-3 text-sm">
          {generate.error.message}
        </p>
      )}
    </form>
  );
}
