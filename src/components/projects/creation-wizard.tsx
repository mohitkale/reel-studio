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
import {
  DEFAULT_VIDEO_ENGINE,
  VIDEO_ENGINE_IDS,
  VIDEO_ENGINE_LABELS,
  type VideoEngineId,
} from "@/engines/types";
import {
  DEFAULT_ORIENTATION,
  ORIENTATIONS,
  ORIENTATION_LABELS,
  type Orientation,
} from "@/lib/orientation";
import {
  PRODUCTION_PRESETS,
  type ProductionPresetId,
} from "@/production/presets";
import { cn } from "@/lib/utils";
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

const STEPS = ["Output", "Content", "Style", "Finish"] as const;
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
  initialPresetId = "product-launch",
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
  const [sourceKind, setSourceKind] = React.useState<SourceKind>("text");
  const [name, setName] = React.useState("");
  const [text, setText] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [presetId, setPresetId] =
    React.useState<ProductionPresetId>(initialPresetId);
  const [orientation, setOrientation] =
    React.useState<Orientation>(DEFAULT_ORIENTATION);
  const [videoEngine, setVideoEngine] =
    React.useState<VideoEngineId>(DEFAULT_VIDEO_ENGINE);
  const [brandKitId, setBrandKitId] = React.useState("");
  const [voiceMode, setVoiceMode] = React.useState<"oneshot" | "per_scene">(
    "oneshot",
  );

  const busy = create.isPending || upload.isPending;
  const contentValid =
    name.trim().length > 0 &&
    (sourceKind === "text"
      ? text.trim().length >= 20
      : /^https?:\/\//i.test(url.trim()));
  const canContinue = step !== 1 || contentValid;

  function reset() {
    setStep(0);
    setOutputType("video");
    setSourceKind("text");
    setName("");
    setText("");
    setUrl("");
    setFiles([]);
    setPresetId(initialPresetId);
    setOrientation(DEFAULT_ORIENTATION);
    setVideoEngine(DEFAULT_VIDEO_ENGINE);
    setBrandKitId("");
    setVoiceMode("oneshot");
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
        name: name.trim(),
        outputType,
        source:
          sourceKind === "text"
            ? { kind: "text", text: text.trim() }
            : { kind: "url", url: url.trim() },
        presetId,
        orientation,
        videoEngine,
        brandKitId: brandKitId || undefined,
        voiceMode,
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
        setOpen(next);
        if (!next && !busy) reset();
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
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create without per-scene setup</DialogTitle>
          <DialogDescription>
            Supply your content and assets. Reel Studio builds a deterministic,
            editable draft locally; no AI key is required.
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

        <div className="min-h-80 py-2">
          {step === 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceCard
                active={outputType === "video"}
                onClick={() => setOutputType("video")}
              >
                <Film className="text-primary mb-3 size-6" />
                <p className="font-medium">Polished video</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Scenes, visual styling, captions, and optional narration.
                </p>
              </ChoiceCard>
              <ChoiceCard
                active={outputType === "voiceover"}
                onClick={() => setOutputType("voiceover")}
              >
                <FileAudio className="text-primary mb-3 size-6" />
                <p className="font-medium">Voiceover-first video</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Preserve the full narration and prepare visual scenes around
                  it.
                </p>
              </ChoiceCard>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-5">
              <div className="grid gap-2">
                <Label htmlFor="production-name">Project name</Label>
                <Input
                  id="production-name"
                  value={name}
                  maxLength={120}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. September product walkthrough"
                  autoFocus
                />
              </div>
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
                    rows={8}
                    value={text}
                    maxLength={12_000}
                    onChange={(event) => setText(event.target.value)}
                    placeholder="Paste a brief, finished script, article, or notes. Every passage is retained in the narration."
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="production-engine">Video engine</Label>
                  <NativeSelect
                    id="production-engine"
                    value={videoEngine}
                    onChange={(event) =>
                      setVideoEngine(event.target.value as VideoEngineId)
                    }
                  >
                    {VIDEO_ENGINE_IDS.map((engine) => (
                      <option key={engine} value={engine}>
                        {VIDEO_ENGINE_LABELS[engine]}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
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
              <div className="bg-muted/30 rounded-xl border p-4 text-sm">
                <p className="font-medium">Ready to build locally</p>
                <p className="text-muted-foreground mt-1">
                  {
                    PRODUCTION_PRESETS.find((preset) => preset.id === presetId)
                      ?.name
                  }{" "}
                  · {VIDEO_ENGINE_LABELS[videoEngine]} ·{" "}
                  {ORIENTATION_LABELS[orientation]}
                </p>
                <p className="text-muted-foreground mt-2 text-xs">
                  The planner creates readable display copy while retaining full
                  source passages as narration. You can edit every scene
                  afterward.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep((value) => Math.max(0, value - 1))}
            disabled={step === 0 || busy}
          >
            <ArrowLeft /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button
              onClick={() =>
                setStep((value) => Math.min(STEPS.length - 1, value + 1))
              }
              disabled={!canContinue}
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
