"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Lightbulb, FileText } from "lucide-react";
import { toast } from "sonner";

import type { AIProviderId, ScriptStyle } from "@/providers/ai/types";
import { useAIProviders, useGenerateProject } from "@/hooks/ai";
import { useBrandKits } from "@/hooks/brandkits";
import {
  type Orientation,
  ORIENTATIONS,
  ORIENTATION_LABELS,
  DEFAULT_ORIENTATION,
} from "@/lib/orientation";
import { DEFAULT_VIDEO_ENGINE } from "@/engines/types";
import {
  StyleEnergyControls,
  type EnergyPick,
  type StylePick,
} from "@/components/visual/style-energy-controls";
import { cn } from "@/lib/utils";
import type { VisualAmbition } from "@/production/motion-plan";
import { VisualAmbitionControl } from "@/components/visual/visual-ambition-control";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import {
  MEDIA_PREFERENCES,
  MEDIA_PREFERENCE_LABELS,
  type MediaPreference,
} from "@/lib/media-preference";
import {
  PRODUCTION_PRESETS,
  type ProductionPresetId,
} from "@/production/presets";
import { DEFAULT_QUICK_PRODUCE_ENABLED } from "@/production/quick-produce";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

const EXAMPLE_BRIEFS = [
  "Explain three ways to build a consistent reading habit, with a practical example for each.",
  "Introduce a note-taking app that turns meeting notes into action items. End with a try-it CTA.",
];

export function CreateWithAIDialog({
  trigger,
}: { trigger?: React.ReactElement } = {}) {
  const router = useRouter();
  const { data: providers } = useAIProviders();
  const generate = useGenerateProject();
  const { data: brandKits = [] } = useBrandKits();
  const [brandKitId, setBrandKitId] = React.useState("");

  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"idea" | "story">("idea");
  const [brief, setBrief] = React.useState("");
  const [providerId, setProviderId] = React.useState<
    AIProviderId | undefined
  >();
  const [sceneCount, setSceneCount] = React.useState<string>("auto");
  const [orientation, setOrientation] =
    React.useState<Orientation>(DEFAULT_ORIENTATION);
  const [scriptStyle, setScriptStyle] = React.useState<ScriptStyle>("short");
  const videoEngine = DEFAULT_VIDEO_ENGINE;
  const [styleId, setStyleId] = React.useState<StylePick>("auto");
  const [energy, setEnergy] = React.useState<EnergyPick>("auto");
  const [productionPresetId, setProductionPresetId] = React.useState<
    ProductionPresetId | "auto"
  >("auto");
  const [visualAmbition, setVisualAmbition] =
    React.useState<VisualAmbition>("expressive");
  const [mediaPreference, setMediaPreference] =
    React.useState<MediaPreference>("auto");
  const [quickProduce, setQuickProduce] = React.useState(
    DEFAULT_QUICK_PRODUCE_ENABLED,
  );
  const [quickPlanner, setQuickPlanner] = React.useState<
    "deterministic" | AIProviderId | undefined
  >();
  const [narration, setNarration] = React.useState(false);

  const configured = (providers ?? []).filter((p) => p.configured);
  const effectiveProvider = providerId ?? configured[0]?.id;

  const effectiveQuickPlanner =
    quickPlanner ?? effectiveProvider ?? "deterministic";
  const validBrief = brief.trim().length >= 3 && brief.trim().length <= 8000;

  function submit() {
    const trimmed = brief.trim();
    if (
      !validBrief ||
      generate.isPending ||
      (!quickProduce && !effectiveProvider)
    )
      return;
    const planner = quickProduce ? effectiveQuickPlanner : effectiveProvider;
    generate.mutate(
      {
        providerId: planner === "deterministic" ? undefined : planner,
        mode,
        brief: trimmed,
        sceneCount: sceneCount === "auto" ? undefined : Number(sceneCount),
        orientation,
        scriptStyle,
        videoEngine,
        styleId,
        energy,
        productionPresetId,
        mediaPreference,
        visualAmbition,
        brandKitId: brandKitId || null,
        ...(quickProduce
          ? {
              idempotencyKey: `quick-produce:${crypto.randomUUID()}`,
              quickProduce: {
                enabled: true as const,
                planner: effectiveQuickPlanner,
                mediaPreference,
                voice: {
                  enabled: narration,
                  providerId: "kokoro-server" as const,
                  voiceId: "af_heart",
                },
              },
            }
          : {}),
      },
      {
        onSuccess: ({ scriptId, mediaDecisions, job }) => {
          setOpen(false);
          setBrief("");

          setStyleId("auto");
          setEnergy("auto");
          setProductionPresetId("auto");
          setMediaPreference("auto");
          setQuickProduce(DEFAULT_QUICK_PRODUCE_ENABLED);
          setQuickPlanner(undefined);
          setNarration(false);
          const selected = mediaDecisions.filter(
            (decision) => decision.state === "selected",
          ).length;
          toast.success(
            quickProduce ? "Quick Produce started" : "Video drafted",
            {
              description: quickProduce
                ? "Follow the saved progress, then download or edit your finished video."
                : selected
                  ? `${selected} stock background${selected === 1 ? "" : "s"} selected. Review every scene in the editor.`
                  : "Your scenes are ready. Review the draft, add narration, and export when you’re happy with it.",
            },
          );
          router.push(job ? `/results/${job.id}` : `/editor/${scriptId}`);
        },
        onError: (e) =>
          toast.error("Generation failed", {
            description: (e as Error).message,
          }),
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!generate.isPending) setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Sparkles />
            Create with AI
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create with AI</DialogTitle>
          <DialogDescription>
            Describe your idea or paste a script. Automatic direction matches
            the visual theme and scene treatments to your content.
          </DialogDescription>
        </DialogHeader>

        {configured.length === 0 && !quickProduce ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
            No AI provider configured. Add a cloud key or select a local model
            in{" "}
            <Link href="/settings" className="text-primary underline">
              Settings
            </Link>{" "}
            to use AI. Create production on the Projects page works with your
            own text and no key.
          </p>
        ) : (
          <fieldset disabled={generate.isPending} className="min-w-0 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: "idea", label: "Quick idea", icon: Lightbulb },
                  { id: "story", label: "Paste a story", icon: FileText },
                ] as const
              ).map((opt) => {
                const Icon = opt.icon;
                const active = mode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMode(opt.id)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    <Icon className="size-4" />
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ai-brief">
                {mode === "idea" ? "Your idea" : "Your story or script"}
              </Label>
              <Textarea
                id="ai-brief"
                rows={mode === "idea" ? 3 : 6}
                maxLength={8000}
                autoFocus
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder={
                  mode === "idea"
                    ? "e.g. 3 quick tips for writing better prompts"
                    : "Paste the full story or script you want turned into a reel..."
                }
              />
              {mode === "idea" ? (
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLE_BRIEFS.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setBrief(example)}
                      className="bg-muted/40 text-muted-foreground hover:border-primary hover:text-foreground rounded-full border px-2.5 py-1 text-[11px] transition-colors"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid items-start gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="ai-production-preset">Visual direction</Label>
                <NativeSelect
                  id="ai-production-preset"
                  value={productionPresetId}
                  onChange={(event) =>
                    setProductionPresetId(
                      event.target.value as ProductionPresetId | "auto",
                    )
                  }
                >
                  <option value="auto">Automatic · match my content</option>
                  {PRODUCTION_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-muted-foreground text-xs">
                  {productionPresetId === "auto"
                    ? "Match the theme, pacing and layouts to your topic. Choose brand colours under Customize style and media."
                    : PRODUCTION_PRESETS.find(
                        (preset) => preset.id === productionPresetId,
                      )?.description}
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="ai-orientation">Orientation</Label>
                <NativeSelect
                  id="ai-orientation"
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
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="ai-provider">Provider</Label>
                <NativeSelect
                  id="ai-provider"
                  value={
                    quickProduce
                      ? effectiveQuickPlanner
                      : (effectiveProvider ?? "")
                  }
                  onChange={(event) =>
                    quickProduce
                      ? setQuickPlanner(
                          event.target.value as "deterministic" | AIProviderId,
                        )
                      : setProviderId(event.target.value as AIProviderId)
                  }
                >
                  {quickProduce && (
                    <option value="deterministic">
                      Deterministic (no AI key)
                    </option>
                  )}
                  {configured.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            {quickProduce && effectiveQuickPlanner === "deterministic" && (
              <p className="text-muted-foreground text-xs">
                The local planner arranges your supplied text into scenes. Paste
                a finished script, or choose an AI provider to develop an idea.
              </p>
            )}
            <details className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Customize style and media
              </summary>
              <div className="mt-4 space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="ai-brand-kit">Colour palette</Label>
                  <NativeSelect
                    id="ai-brand-kit"
                    value={brandKitId}
                    onChange={(event) => setBrandKitId(event.target.value)}
                    disabled={generate.isPending}
                  >
                    <option value="">Automatic · match my content</option>
                    {brandKits.map((kit) => (
                      <option key={kit.id} value={kit.id}>
                        {kit.name}
                      </option>
                    ))}
                  </NativeSelect>
                  <p className="text-muted-foreground text-xs">
                    Automatic uses the story’s palette. A selected brand kit
                    keeps its colours.
                  </p>
                </div>
                <VisualAmbitionControl
                  id="ai-visual-ambition"
                  value={visualAmbition}
                  onChange={setVisualAmbition}
                  disabled={generate.isPending}
                />

                <StyleEnergyControls
                  styleId={styleId}
                  energy={energy}
                  onStyleChange={setStyleId}
                  onEnergyChange={setEnergy}
                  allowAuto
                  compact
                />

                <div className="grid gap-2">
                  <Label>Voice script</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        id: "short" as const,
                        label: "Short",
                        description:
                          "Same short line on screen and in voice (~14–18 words).",
                      },
                      {
                        id: "detailed" as const,
                        label: "Detailed",
                        description:
                          "Short on-screen text + longer voiceover (~2–3×).",
                      },
                    ].map((opt) => {
                      const active = scriptStyle === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setScriptStyle(opt.id)}
                          className={cn(
                            "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                            active
                              ? "border-primary bg-primary/10 text-foreground"
                              : "text-muted-foreground hover:bg-accent",
                          )}
                        >
                          <span className="font-medium">{opt.label}</span>
                          <span className="text-xs opacity-70">
                            {opt.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="ai-media-preference">Automatic media</Label>
                  <NativeSelect
                    id="ai-media-preference"
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
                    Exportable images: Pexels → Pixabay. Video fallback: Pexels
                    → Pixabay. Existing uploads and manual selections always
                    win; no result uses the animated mood background.
                  </p>
                </div>

                <div className="grid gap-2">
                  <HintTooltip
                    label="How many scenes the AI should write. Auto usually picks 5–10."
                    side="top"
                  >
                    <Label htmlFor="ai-scenes">Scenes</Label>
                  </HintTooltip>
                  <NativeSelect
                    id="ai-scenes"
                    value={sceneCount}
                    onChange={(event) => setSceneCount(event.target.value)}
                  >
                    <option value="auto">Auto (AI decides)</option>
                    {[4, 5, 6, 7, 8, 10, 12, 14, 16].map((count) => (
                      <option key={count} value={count}>
                        {count} scenes
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>
            </details>
          </fieldset>
        )}

        <fieldset
          disabled={generate.isPending}
          className="min-w-0 space-y-3 rounded-xl border p-4"
        >
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={quickProduce}
              onChange={(event) => setQuickProduce(event.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">Quick Produce</span>
              <span className="text-muted-foreground mt-1 block text-xs">
                Automatically render a downloadable MP4 after creating the
                draft. Leave off to review your scenes first.
              </span>
            </span>
          </label>
          {quickProduce && (
            <label className="flex cursor-pointer items-start gap-3 border-t pt-3">
              <input
                type="checkbox"
                checked={narration}
                onChange={(event) => setNarration(event.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium">
                  Add local narration
                </span>
                <span className="text-muted-foreground mt-1 block text-xs">
                  Uses Kokoro voice af_heart. Set up local voice in Settings
                  first; the first synthesis may download the model. Leave off
                  for a silent video.
                </span>
              </span>
            </label>
          )}
        </fieldset>
        {generate.isError && (
          <p role="alert" className="text-destructive text-sm">
            {generate.error.message}
          </p>
        )}

        <DialogFooter className="bg-card sticky -bottom-6 -mx-6 border-t px-6 pt-3 pb-6">
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            onClick={submit}
            disabled={
              !validBrief ||
              (!quickProduce && !effectiveProvider) ||
              generate.isPending
            }
          >
            {generate.isPending ? (
              <>
                <Loader2 className="animate-spin" />
                {quickProduce ? "Starting production..." : "Generating..."}
              </>
            ) : (
              <>
                <Sparkles />
                {quickProduce ? "Create and produce" : "Create draft"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
