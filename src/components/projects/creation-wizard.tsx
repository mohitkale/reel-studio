"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  FileAudio,
  FileText,
  Film,
  Globe2,
  Loader2,
  Upload,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";

import { useBrandKits } from "@/hooks/brandkits";
import { useUploadAsset } from "@/hooks/assets";
import { useCreateManualProduction } from "@/hooks/script";
import { DEFAULT_VIDEO_ENGINE } from "@/engines/types";
import {
  DEFAULT_ORIENTATION,
  ORIENTATIONS,
  ORIENTATION_LABELS,
  type Orientation,
} from "@/lib/orientation";
import {
  MEDIA_PREFERENCES,
  MEDIA_PREFERENCE_LABELS,
  type MediaPreference,
} from "@/lib/media-preference";
import {
  PRODUCTION_PRESETS,
  type ProductionPresetId,
} from "@/production/presets";
import { cn } from "@/lib/utils";
import type { VisualAmbition } from "@/production/motion-plan";
import { VisualAmbitionControl } from "@/components/visual/visual-ambition-control";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

const STEPS = ["Content", "Output", "Style", "Finish"] as const;
type SourceKind = "text" | "url";
type OutputType = "video" | "voiceover";

function ChoiceCard({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border p-4 text-left transition-colors",
        active
          ? "border-primary bg-primary/8 shadow-sm"
          : "hover:border-primary/40 hover:bg-muted/40",
      )}
    >
      {children}
    </button>
  );
}

export function CreationWizard({
  initialPresetId = "editorial-explainer",
  trigger,
}: {
  initialPresetId?: ProductionPresetId;
  trigger?: React.ReactElement;
} = {}) {
  const router = useRouter();
  const create = useCreateManualProduction();
  const upload = useUploadAsset();
  const { data: brandKits = [] } = useBrandKits();
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [outputType, setOutputType] = React.useState<OutputType>("video");
  const [structure, setStructure] = React.useState<"single" | "chapters">(
    "single",
  );
  const [sourceKind, setSourceKind] = React.useState<SourceKind>("text");
  const [name, setName] = React.useState("");
  const [text, setText] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [presetId, setPresetId] =
    React.useState<ProductionPresetId>(initialPresetId);
  const [orientation, setOrientation] =
    React.useState<Orientation>(DEFAULT_ORIENTATION);
  const videoEngine = DEFAULT_VIDEO_ENGINE;
  const [brandKitId, setBrandKitId] = React.useState("");
  const [voiceMode, setVoiceMode] = React.useState<"oneshot" | "per_scene">(
    "oneshot",
  );
  const [visualAmbition, setVisualAmbition] =
    React.useState<VisualAmbition>("expressive");
  const [mediaPreference, setMediaPreference] =
    React.useState<MediaPreference>("auto");

  const busy = create.isPending || upload.isPending;
  const contentValid =
    sourceKind === "text"
      ? text.trim().length >= 20 && text.trim().length <= 12_000
      : /^https?:\/\//i.test(url.trim());
  const canContinue = step !== 0 || contentValid;

  function reset() {
    setStep(0);
    setOutputType("video");
    setStructure("single");
    setSourceKind("text");
    setName("");
    setText("");
    setUrl("");
    setFiles([]);
    setPresetId(initialPresetId);
    setOrientation(DEFAULT_ORIENTATION);

    setBrandKitId("");
    setVoiceMode("oneshot");
    setMediaPreference("auto");
    setVisualAmbition("expressive");
  }

  async function submit() {
    if (!contentValid || busy) return;
    const uploaded = [];
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.set("file", file);
        formData.set("name", file.name);
        uploaded.push(await upload.mutateAsync(formData));
      }
      const result = await create.mutateAsync({
        name:
          name.trim() ||
          (sourceKind === "text"
            ? text
                .trim()
                .split(/[.!?\n]/, 1)[0]!
                .slice(0, 120)
            : "Article video"),
        outputType,
        structure,
        source:
          sourceKind === "text"
            ? { kind: "text", text: text.trim() }
            : { kind: "url", url: url.trim() },
        presetId,
        orientation,
        videoEngine,
        brandKitId: brandKitId || undefined,
        voiceMode,
        mediaPreference,
        visualAmbition,
        assetIds: uploaded.map((asset) => asset.id),
      });
      setOpen(false);
      reset();
      toast.success("Production draft ready", {
        description:
          result.warnings[0] ??
          "Your content is already arranged into editable scenes.",
      });
      router.push(`/editor/${result.scriptId}`);
    } catch (error) {
      await Promise.allSettled(
        uploaded.map((asset) =>
          fetch(`/api/assets/${asset.id}`, { method: "DELETE" }),
        ),
      );
      toast.error("Could not create production", {
        description: (error as Error).message,
      });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <WandSparkles />
            Create production
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create production</DialogTitle>
          <DialogDescription>
            Paste your content or import an article. Build a styled draft now,
            or customize the output first. No AI key is required.
          </DialogDescription>
        </DialogHeader>

        <ol className="grid grid-cols-4 gap-2" aria-label="Creation progress">
          {STEPS.map((label, index) => (
            <li key={label} className="space-y-1">
              <div
                className={cn(
                  "h-1.5 rounded-full",
                  index <= step ? "bg-primary" : "bg-muted",
                )}
              />
              <span
                className={cn(
                  "text-xs",
                  index === step
                    ? "text-foreground font-medium"
                    : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </li>
          ))}
        </ol>

        <fieldset disabled={busy} className="min-h-80 min-w-0 py-2">
          {step === 1 ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <ChoiceCard
                active={outputType === "video" && structure === "single"}
                onClick={() => {
                  setOutputType("video");
                  setStructure("single");
                }}
              >
                <Film className="text-primary mb-3 size-6" />
                <p className="font-medium">Polished video</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  A concise short cut with visual styling and optional
                  narration.
                </p>
              </ChoiceCard>
              <ChoiceCard
                active={outputType === "voiceover" && structure === "single"}
                onClick={() => {
                  setOutputType("voiceover");
                  setStructure("single");
                }}
              >
                <FileAudio className="text-primary mb-3 size-6" />
                <p className="font-medium">Voiceover-first video</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Preserve the full narration and prepare visual scenes around
                  it.
                </p>
              </ChoiceCard>
              <ChoiceCard
                active={structure === "chapters"}
                onClick={() => {
                  setOutputType("video");
                  setStructure("chapters");
                }}
              >
                <Film className="text-primary mb-3 size-6" />
                <p className="font-medium">Chaptered video</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Keep your full script in editable chapters, with varied visual
                  beats.
                </p>
              </ChoiceCard>
            </div>
          ) : null}

          {step === 0 ? (
            <div className="space-y-5">
              <p className="bg-muted/30 rounded-lg border p-3 text-sm">
                Ready to use:{" "}
                {
                  PRODUCTION_PRESETS.find((preset) => preset.id === presetId)
                    ?.name
                }{" "}
                · {ORIENTATION_LABELS[orientation]} · Default brand kit. Review
                your scenes, then add narration and export in the editor.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <ChoiceCard
                  active={sourceKind === "text"}
                  onClick={() => setSourceKind("text")}
                >
                  <FileText className="mb-2 size-5" />
                  <span className="text-sm font-medium">
                    Paste text or script
                  </span>
                </ChoiceCard>
                <ChoiceCard
                  active={sourceKind === "url"}
                  onClick={() => setSourceKind("url")}
                >
                  <Globe2 className="mb-2 size-5" />
                  <span className="text-sm font-medium">
                    Public article URL
                  </span>
                </ChoiceCard>
              </div>
              {sourceKind === "text" ? (
                <div className="grid gap-2">
                  <Label htmlFor="production-copy">Source content</Label>
                  <Textarea
                    id="production-copy"
                    autoFocus
                    rows={8}
                    value={text}
                    maxLength={12_000}
                    onChange={(event) => setText(event.target.value)}
                    placeholder={
                      outputType === "voiceover" || structure === "chapters"
                        ? "Paste a finished script or article. Every passage is retained in the narration."
                        : "Paste a brief, article, or notes. Reel Studio selects the strongest passages for short-form pacing."
                    }
                  />
                  <p className="text-muted-foreground text-xs">
                    {text.trim().length.toLocaleString()} / 12,000 characters
                  </p>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label htmlFor="production-url">Article URL</Label>
                  <Input
                    id="production-url"
                    autoFocus
                    type="url"
                    value={url}
                    maxLength={2_048}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://example.com/article"
                  />
                  <p className="text-muted-foreground text-xs">
                    Only public HTML or text pages are fetched. Local and
                    private network addresses are blocked.
                  </p>
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="production-name">Project name (optional)</Label>
                <Input
                  id="production-name"
                  value={name}
                  maxLength={120}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. September product walkthrough"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="production-assets">
                  Screenshots, images, video, or audio (optional)
                </Label>
                <label
                  htmlFor="production-assets"
                  className="hover:bg-muted/40 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-4 text-sm"
                >
                  <Upload className="text-muted-foreground size-5" />
                  <span>
                    {files.length
                      ? `${files.length} file${files.length === 1 ? "" : "s"} selected`
                      : "Choose up to 12 source files"}
                  </span>
                </label>
                <Input
                  id="production-assets"
                  className="sr-only"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/ogg,audio/aac,audio/mp4"
                  onChange={(event) =>
                    setFiles(Array.from(event.target.files ?? []).slice(0, 12))
                  }
                />
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {PRODUCTION_PRESETS.map((preset) => (
                  <ChoiceCard
                    key={preset.id}
                    active={presetId === preset.id}
                    onClick={() => setPresetId(preset.id)}
                  >
                    <p className="font-medium">{preset.name}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {preset.description}
                    </p>
                  </ChoiceCard>
                ))}
              </div>
              {outputType === "video" ? (
                <VisualAmbitionControl
                  id="production-ambition"
                  value={visualAmbition}
                  onChange={setVisualAmbition}
                />
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="production-orientation">Format</Label>
                  <NativeSelect
                    id="production-orientation"
                    value={orientation}
                    onChange={(event) =>
                      setOrientation(event.target.value as Orientation)
                    }
                  >
                    {ORIENTATIONS.map((value) => (
                      <option key={value} value={value}>
                        {ORIENTATION_LABELS[value]}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <div className="grid gap-2">
                <Label htmlFor="production-brand">Brand kit</Label>
                <NativeSelect
                  id="production-brand"
                  value={brandKitId}
                  onChange={(event) => setBrandKitId(event.target.value)}
                >
                  <option value="">Use the default brand kit</option>
                  {brandKits.map((kit) => (
                    <option key={kit.id} value={kit.id}>
                      {kit.name}
                      {kit.isDefault ? " (default)" : ""}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="grid gap-2">
                <Label>Narration workflow</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ChoiceCard
                    active={voiceMode === "oneshot"}
                    onClick={() => setVoiceMode("oneshot")}
                  >
                    <p className="font-medium">One full take</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Generate or upload one continuous narration after
                      reviewing the draft.
                    </p>
                  </ChoiceCard>
                  <ChoiceCard
                    active={voiceMode === "per_scene"}
                    onClick={() => setVoiceMode("per_scene")}
                  >
                    <p className="font-medium">Scene clips</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Regenerate and mix individual lines without replacing
                      unchanged clips.
                    </p>
                  </ChoiceCard>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="production-media">Automatic media</Label>
                <NativeSelect
                  id="production-media"
                  value={mediaPreference}
                  onChange={(event) =>
                    setMediaPreference(event.target.value as MediaPreference)
                  }
                >
                  {MEDIA_PREFERENCES.map((value) => (
                    <option key={value} value={value}>
                      {MEDIA_PREFERENCE_LABELS[value]}
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-muted-foreground text-xs">
                  Auto adds relevant B-roll when a stock provider is configured;
                  uploads always win. If no result is available, Reel Studio
                  uses an animated layout.
                </p>
              </div>
              <div className="bg-muted/30 rounded-xl border p-4 text-sm">
                <p className="font-medium">Ready to build locally</p>
                <p className="text-muted-foreground mt-1">
                  {
                    PRODUCTION_PRESETS.find((preset) => preset.id === presetId)
                      ?.name
                  }{" "}
                  · HyperFrames · {ORIENTATION_LABELS[orientation]}
                </p>
                <p className="text-muted-foreground mt-2 text-xs">
                  {structure === "chapters"
                    ? "The planner keeps the full narration and builds editable chapters. Exports support up to 5 minutes with a valid chapter plan. Review the estimated timing before generating a voice take."
                    : outputType === "voiceover"
                      ? "The planner preserves every source passage as narration and builds readable visual beats around it."
                      : "The planner selects a concise short-form cut, varies visual beats, and adds relevant media when available."}{" "}
                  You can edit every scene afterward.
                </p>
              </div>
            </div>
          ) : null}
        </fieldset>
        {create.isError && (
          <p role="alert" className="text-destructive text-sm">
            {create.error.message}
          </p>
        )}

        <DialogFooter className="bg-card sticky -bottom-6 -mx-6 gap-2 border-t px-6 pt-3 pb-6 sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep((value) => Math.max(0, value - 1))}
            disabled={step === 0 || busy}
          >
            <ArrowLeft /> Back
          </Button>
          {step === 0 ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                disabled={!contentValid || busy}
              >
                Customize options <ArrowRight />
              </Button>
              <Button onClick={submit} disabled={!contentValid || busy}>
                {busy ? <Loader2 className="animate-spin" /> : <WandSparkles />}
                {busy ? "Building draft…" : "Build draft"}
              </Button>
            </div>
          ) : step < STEPS.length - 1 ? (
            <Button
              onClick={() =>
                setStep((value) => Math.min(STEPS.length - 1, value + 1))
              }
              disabled={!canContinue || busy}
            >
              Continue <ArrowRight />
            </Button>
          ) : (
            <Button onClick={submit} disabled={!contentValid || busy}>
              {busy ? <Loader2 className="animate-spin" /> : <WandSparkles />}
              {busy ? "Building draft…" : "Build draft"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
