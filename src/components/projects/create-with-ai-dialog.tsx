"use client";
import { GenerationSummary } from "@/components/studio/generation-summary";
import { ResearchSelection } from "./research-selection";
import type { EvidencePack } from "@/research/contracts";
import type { CreationSettings } from "@/research/creation-settings";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Lightbulb, FileText } from "lucide-react";
import { toast } from "sonner";

import type { AIProviderId, ScriptStyle } from "@/providers/ai/types";
import {
  useAIProviders,
  useGenerateProject,
  useGenerateEditorialProject,
} from "@/hooks/ai";
import {
  creativeBriefSchema,
  type CreativeBrief,
} from "@/production/editorial";
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
  initialQuickProduce = DEFAULT_QUICK_PRODUCE_ENABLED,
  initialSettings,
  initialEvidence,
}: {
  trigger?: React.ReactElement;
  initialQuickProduce?: boolean;
  initialSettings?: CreationSettings;
  initialEvidence?: EvidencePack;
} = {}) {
  const router = useRouter();
  const { data: providers } = useAIProviders();
  const generate = useGenerateProject();
  const editorial = useGenerateEditorialProject();
  const [editorialCallBudget, setEditorialCallBudget] = React.useState(1);
  const [reviewScript, setReviewScript] = React.useState(false);
  const [creativeBrief, setCreativeBrief] = React.useState<CreativeBrief>({
    intent: "explainer",
    audience: "General audience",
    goal: "Explain the supplied subject clearly",
    language: "English",
    targetSeconds: 45,
    tone: "Clear and conversational",
    takeaway: "Understand the main idea and a useful next step",
  });
  const editorialRequestKey = React.useRef<{
    content: string;
    key: string;
  } | null>(null);
  const { data: brandKits = [] } = useBrandKits();
  const [brandKitId, setBrandKitId] = React.useState(
    initialSettings?.brandKitId ?? "",
  );

  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"idea" | "story">(
    initialSettings?.mode ?? "idea",
  );
  const [brief, setBrief] = React.useState(initialSettings?.brief ?? "");
  const [providerId, setProviderId] = React.useState<AIProviderId | undefined>(
    initialSettings?.writer?.providerId,
  );
  const [writerModelId, setWriterModelId] = React.useState(
    initialSettings?.writer?.modelId ?? "",
  );
  const [sceneCount, setSceneCount] = React.useState<string>(
    initialSettings?.sceneCount?.toString() ?? "auto",
  );
  const [orientation, setOrientation] = React.useState<Orientation>(
    initialSettings?.orientation ?? DEFAULT_ORIENTATION,
  );
  const [scriptStyle, setScriptStyle] = React.useState<ScriptStyle>(
    initialSettings?.scriptStyle ?? "short",
  );
  const videoEngine = DEFAULT_VIDEO_ENGINE;
  const [styleId, setStyleId] = React.useState<StylePick>(
    initialSettings?.styleId ?? "auto",
  );
  const [energy, setEnergy] = React.useState<EnergyPick>(
    initialSettings?.energy ?? "auto",
  );
  const [productionPresetId, setProductionPresetId] = React.useState<
    ProductionPresetId | "auto"
  >(initialSettings?.productionPresetId ?? "auto");
  const [visualAmbition, setVisualAmbition] = React.useState<VisualAmbition>(
    initialSettings?.visualAmbition ?? "expressive",
  );
  const [mediaPreference, setMediaPreference] = React.useState<MediaPreference>(
    initialSettings?.mediaPreference ?? "auto",
  );
  const [quickProduce, setQuickProduce] = React.useState(
    initialSettings
      ? Boolean(initialSettings.quickProduce)
      : initialQuickProduce,
  );
  const [quickPlanner, setQuickPlanner] = React.useState<
    "deterministic" | AIProviderId | undefined
  >(initialSettings?.quickProduce?.planner);
  const [narration, setNarration] = React.useState(
    initialSettings?.quickProduce?.voice.enabled ?? false,
  );
  const [evidence, setEvidence] = React.useState<EvidencePack | null>(
    initialEvidence ?? null,
  );
  const [reuseEvidence, setReuseEvidence] = React.useState(
    Boolean(initialEvidence),
  );
  const updateEvidence = React.useCallback((value: EvidencePack | null) => {
    setEvidence(value);
    setReuseEvidence(false);
  }, []);
  const [researchMode, setResearchMode] = React.useState<
    "off" | "supplied" | "web"
  >(
    initialEvidence
      ? initialEvidence.provenance.kind === "native_search"
        ? "web"
        : "supplied"
      : "off",
  );
  const researchRequired = researchMode !== "off";

  const configured = (providers ?? []).filter((p) => p.configured);
  const effectiveProvider = providerId ?? configured[0]?.id;

  const effectiveQuickPlanner =
    quickPlanner ?? effectiveProvider ?? "deterministic";
  const validBrief = brief.trim().length >= 3 && brief.trim().length <= 8000;
  const readyEvidence =
    evidence && (reuseEvidence || evidence.query === brief.trim())
      ? evidence
      : null;

  function submit() {
    const trimmed = brief.trim();
    if (
      !validBrief ||
      generate.isPending ||
      editorial.isPending ||
      (!quickProduce && !effectiveProvider) ||
      (researchRequired &&
        (!readyEvidence ||
          (quickProduce && effectiveQuickPlanner === "deterministic")))
    )
      return;
    const planner = quickProduce ? effectiveQuickPlanner : effectiveProvider;
    if (reviewScript && planner && planner !== "deterministic") {
      const input = {
        brief: trimmed,
        creativeBrief,
        providerId: planner,
        modelId: writerModelId.trim() || undefined,
        evidenceId: researchRequired ? readyEvidence?.id : undefined,
        orientation,
        brandKitId: brandKitId || null,
        budget: { maxProviderCalls: editorialCallBudget, deadlineMs: 30_000 },
      };
      const content = JSON.stringify(input);
      if (editorialRequestKey.current?.content !== content)
        editorialRequestKey.current = {
          content,
          key: `editorial:${crypto.randomUUID()}`,
        };
      editorial.mutate(
        { ...input, idempotencyKey: editorialRequestKey.current.key },
        {
          onSuccess: ({ scriptId }) => {
            setOpen(false);
            router.push(`/editor/${scriptId}`);
          },
        },
      );
      return;
    }
    generate.mutate(
      {
        providerId: planner === "deterministic" ? undefined : planner,
        modelId: writerModelId.trim() || undefined,
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
        evidenceId: researchRequired ? readyEvidence?.id : undefined,
        ...(quickProduce
          ? {
              idempotencyKey: `quick-produce:${crypto.randomUUID()}`,
              quickProduce: {
                enabled: true as const,
                planner: effectiveQuickPlanner,
                plannerModelId: writerModelId.trim() || undefined,
                mediaPreference,
                voice: {
                  ...(initialSettings?.quickProduce?.voice ?? {}),
                  enabled: narration,
                  providerId:
                    initialSettings?.quickProduce?.voice.providerId ??
                    "kokoro-server",
                  voiceId:
                    initialSettings?.quickProduce?.voice.voiceId ?? "af_heart",
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
        if (!generate.isPending && !editorial.isPending) setOpen(next);
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
          <fieldset
            disabled={generate.isPending || editorial.isPending}
            className="min-w-0 space-y-4"
          >
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
                onChange={(e) => {
                  setBrief(e.target.value);
                  if (!reuseEvidence) setEvidence(null);
                }}
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

            <ResearchSelection
              key={brief}
              brief={brief}
              onEvidence={updateEvidence}
              mode={researchMode}
              onModeChange={setResearchMode}
              initialEvidence={readyEvidence ?? undefined}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={reviewScript}
                onChange={(event) => {
                  setReviewScript(event.target.checked);
                  if (event.target.checked) setQuickProduce(false);
                }}
              />
              Review editorial script before scene layouts
            </label>
            {reviewScript && (
              <details open className="space-y-3 rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Creative brief
                </summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm">
                    Intent
                    <NativeSelect
                      aria-label="Editorial intent"
                      value={creativeBrief.intent}
                      onChange={(event) =>
                        setCreativeBrief({
                          ...creativeBrief,
                          intent: event.target.value as CreativeBrief["intent"],
                        })
                      }
                    >
                      {["product", "explainer", "news", "data", "brand"].map(
                        (intent) => (
                          <option key={intent} value={intent}>
                            {intent}
                          </option>
                        ),
                      )}
                    </NativeSelect>
                  </label>
                  {(
                    [
                      "audience",
                      "goal",
                      "language",
                      "tone",
                      "takeaway",
                    ] as const
                  ).map((field) => (
                    <label key={field} className="text-sm capitalize">
                      {field}
                      <input
                        className="bg-background mt-1 w-full rounded-md border px-3 py-2"
                        aria-label={`Editorial ${field}`}
                        maxLength={
                          field === "language"
                            ? 80
                            : field === "tone"
                              ? 160
                              : field === "audience"
                                ? 300
                                : 500
                        }
                        value={creativeBrief[field]}
                        onChange={(event) =>
                          setCreativeBrief({
                            ...creativeBrief,
                            [field]: event.target.value,
                          })
                        }
                      />
                    </label>
                  ))}
                  <label className="text-sm">
                    Total writer call budget (writing + optional revisions)
                    <NativeSelect
                      aria-label="Editorial call budget"
                      value={String(editorialCallBudget)}
                      onChange={(event) =>
                        setEditorialCallBudget(Number(event.target.value))
                      }
                    >
                      <option value="1">1 — initial writing only</option>
                      <option value="2">
                        2 — writing + one explicit revision
                      </option>
                      <option value="3">
                        3 — writing + two explicit revisions
                      </option>
                    </NativeSelect>
                  </label>
                  <label className="text-sm">
                    Target seconds
                    <input
                      className="bg-background mt-1 w-full rounded-md border px-3 py-2"
                      type="number"
                      min={15}
                      max={180}
                      aria-label="Editorial target seconds"
                      value={creativeBrief.targetSeconds}
                      onChange={(event) =>
                        setCreativeBrief({
                          ...creativeBrief,
                          targetSeconds: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                <p className="text-muted-foreground text-xs">
                  One explicit writer call. Source gaps remain visible; no
                  layouts, media, narration synthesis or export are created at
                  this stage.
                </p>
              </details>
            )}
            {researchRequired &&
              quickProduce &&
              effectiveQuickPlanner === "deterministic" && (
                <p className="text-muted-foreground text-sm">
                  Select an AI planner to create from research. The
                  supplied-text arrangement does not use research.
                </p>
              )}

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
                  onChange={(event) => {
                    setWriterModelId("");
                    if (quickProduce)
                      setQuickPlanner(
                        event.target.value as "deterministic" | AIProviderId,
                      );
                    else setProviderId(event.target.value as AIProviderId);
                  }}
                >
                  {quickProduce && (
                    <option value="deterministic">
                      Deterministic (no AI key)
                    </option>
                  )}
                  {(quickProduce ? effectiveQuickPlanner : effectiveProvider) &&
                    (quickProduce
                      ? effectiveQuickPlanner
                      : effectiveProvider) !== "deterministic" &&
                    !configured.some(
                      (provider) =>
                        provider.id ===
                        (quickProduce
                          ? effectiveQuickPlanner
                          : effectiveProvider),
                    ) && (
                      <option
                        value={
                          quickProduce
                            ? effectiveQuickPlanner
                            : effectiveProvider
                        }
                      >
                        {quickProduce
                          ? effectiveQuickPlanner
                          : effectiveProvider}{" "}
                        (not configured)
                      </option>
                    )}
                  {configured.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.label}
                    </option>
                  ))}
                </NativeSelect>
                {(quickProduce ? effectiveQuickPlanner : effectiveProvider) !==
                  "deterministic" && (
                  <>
                    <Label htmlFor="ai-writer-model">Writer model</Label>
                    <input
                      id="ai-writer-model"
                      className="bg-background rounded-md border px-3 py-2 text-sm"
                      value={writerModelId}
                      onChange={(event) => setWriterModelId(event.target.value)}
                      placeholder="Configured default"
                      maxLength={160}
                    />
                  </>
                )}
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
              id="ai-quick-produce"
              type="checkbox"
              checked={quickProduce}
              disabled={reviewScript || editorial.isPending}
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
                id="ai-narration"
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
                  {initialSettings?.quickProduce?.voice
                    ? `Keeps ${initialSettings.quickProduce.voice.providerId} voice ${initialSettings.quickProduce.voice.voiceId}.`
                    : "Uses Kokoro voice af_heart. Set up local voice in Settings first."}{" "}
                  Leave off for a silent video.
                </span>
              </span>
            </label>
          )}
        </fieldset>
        {(generate.isError || editorial.isError) && (
          <p role="alert" className="text-destructive text-sm">
            {editorial.error?.message ?? generate.error?.message}
          </p>
        )}

        <GenerationSummary
          providerId={quickProduce ? effectiveQuickPlanner : effectiveProvider}
          text={brief}
          scope={
            reviewScript
              ? "Write and review an editorial script (one writer call)"
              : quickProduce
                ? "Plan and produce from this brief"
                : "Create a script draft"
          }
        />
        <DialogFooter className="bg-card sticky -bottom-6 -mx-6 border-t px-6 pt-3 pb-6">
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            onClick={submit}
            disabled={
              !validBrief ||
              (!quickProduce && !effectiveProvider) ||
              (researchRequired &&
                (!readyEvidence ||
                  (quickProduce &&
                    effectiveQuickPlanner === "deterministic"))) ||
              generate.isPending ||
              editorial.isPending ||
              (reviewScript &&
                (quickProduce ||
                  !effectiveProvider ||
                  !creativeBriefSchema.safeParse(creativeBrief).success))
            }
          >
            {generate.isPending || editorial.isPending ? (
              <>
                <Loader2 className="animate-spin" />
                {quickProduce ? "Starting production..." : "Generating..."}
              </>
            ) : (
              <>
                <Sparkles />
                {reviewScript
                  ? "Write editorial script"
                  : quickProduce
                    ? "Create and produce"
                    : "Create draft"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
