"use client";

import * as React from "react";
import {
  Lightbulb,
  Loader2,
  Lock,
  Plus,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { useAIProviders } from "@/hooks/ai";
import { useEnhanceScript, useUpdateScene } from "@/hooks/script";
import type { SceneDTO } from "@/lib/dto";
import { cn } from "@/lib/utils";
import type { AIProviderId, AIScene, ScriptStyle } from "@/providers/ai/types";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MEDIA_PREFERENCES,
  MEDIA_PREFERENCE_LABELS,
  type MediaPreference,
} from "@/lib/media-preference";

const MODES = [
  {
    id: "rewrite" as const,
    label: "Rewrite selected",
    icon: RefreshCcw,
    description: "Refresh chosen scenes while respecting their locks.",
  },
  {
    id: "append" as const,
    label: "Add scenes",
    icon: Plus,
    description: "Continue the story with capability-matched scenes.",
  },
  {
    id: "hook_variants" as const,
    label: "Hook ideas",
    icon: Lightbulb,
    description: "Compare three openings before changing anything.",
  },
];

type EnhanceMode = (typeof MODES)[number]["id"];

export function AIEnhanceDialog({
  scriptId,
  scriptName,
  scenes,
  open,
  onOpenChange,
  onBeforeEnhance,
  onEnhanceSuccess,
}: {
  scriptId: string;
  scriptName: string;
  scenes: SceneDTO[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBeforeEnhance?: () => void;
  onEnhanceSuccess?: () => void;
}) {
  const { data: providers } = useAIProviders();
  const enhance = useEnhanceScript(scriptId);
  const updateScene = useUpdateScene(scriptId);

  const [mode, setMode] = React.useState<EnhanceMode>("rewrite");
  const [briefOverride, setBrief] = React.useState<string | null>(null);
  const brief =
    briefOverride ?? (scriptName !== "Untitled script" ? scriptName : "");
  const [providerId, setProviderId] = React.useState<
    AIProviderId | undefined
  >();
  const [sceneCount, setSceneCount] = React.useState<string>("auto");
  const [scriptStyle, setScriptStyle] = React.useState<ScriptStyle>("short");
  const [selectionOverrides, setSelectionOverrides] = React.useState<
    Record<string, boolean>
  >({});
  const [alternatives, setAlternatives] = React.useState<AIScene[]>([]);
  const [mediaPreference, setMediaPreference] =
    React.useState<MediaPreference>("auto");

  const configured = (providers ?? []).filter(
    (provider) => provider.configured,
  );
  const effectiveProvider = providerId ?? configured[0]?.id;
  const validSelectedIds = scenes
    .filter(
      (scene) => !scene.locks?.scene && selectionOverrides[scene.id] !== false,
    )
    .map((scene) => scene.id);
  const selectedSet = new Set(validSelectedIds);
  const openingLocked =
    scenes[0]?.locks?.scene === true || scenes[0]?.locks?.copy === true;

  function submit() {
    const trimmed = brief.trim();
    if (!trimmed || !effectiveProvider) return;
    if (mode === "rewrite" && validSelectedIds.length === 0) return;
    if (mode !== "hook_variants") onBeforeEnhance?.();
    enhance.mutate(
      {
        providerId: effectiveProvider,
        mode,
        brief: trimmed,
        sceneCount:
          mode === "append" && sceneCount !== "auto"
            ? Number(sceneCount)
            : undefined,
        sceneIds: mode === "rewrite" ? validSelectedIds : undefined,
        scriptStyle,
        mediaPreference,
      },
      {
        onSuccess: (result) => {
          if (mode === "hook_variants") {
            setAlternatives(result.alternatives ?? []);
            return;
          }
          onOpenChange(false);
          onEnhanceSuccess?.();
          toast.success(
            mode === "rewrite" ? "Selected scenes rewritten" : "Scenes added",
            {
              description:
                mode === "rewrite"
                  ? `${result.changedSceneIds?.length ?? validSelectedIds.length} scenes updated; locked content stayed unchanged.`
                  : result.mediaDecisions?.some(
                        (decision) => decision.state === "selected",
                      )
                    ? "New scenes were added with deterministic stock selections where available."
                    : "New scenes were added; no stock result was available, so mood backgrounds remain.",
            },
          );
        },
        onError: (error) =>
          toast.error("AI generation failed", {
            description: (error as Error).message,
          }),
      },
    );
  }

  function applyAlternative(alternative: AIScene) {
    const opening = scenes[0];
    if (!opening || openingLocked) return;
    onBeforeEnhance?.();
    updateScene.mutate(
      {
        id: opening.id,
        text: alternative.text,
        spokenText: alternative.spokenText ?? null,
        templateId: alternative.templateId,
        emphasis: alternative.emphasis,
        visual: alternative.visual ?? null,
        items: alternative.items ?? null,
        chart: alternative.chart ?? null,
        mood: alternative.mood ?? null,
        musicMood: alternative.musicMood ?? null,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onEnhanceSuccess?.();
          toast.success("Opening updated", {
            description: "The selected hook replaced scene 1.",
          });
        },
        onError: (error) =>
          toast.error("Could not apply hook", {
            description: (error as Error).message,
          }),
      },
    );
  }

  const countOptions: ComboboxOption[] = [
    { value: "auto", label: "Auto (AI decides)" },
    ...["2", "3", "4", "5", "6", "8"].map((value) => ({
      value,
      label: `${value} scenes`,
    })),
  ];
  const pending = enhance.isPending || updateScene.isPending;
  const canSubmit =
    Boolean(brief.trim() && effectiveProvider) &&
    (mode !== "rewrite" || validSelectedIds.length > 0) &&
    (mode !== "hook_variants" || scenes.length > 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setAlternatives([]);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" />
            Generate scenes with AI
          </DialogTitle>
          <DialogDescription>
            Choose exactly what AI may change. Preset capabilities and factual
            source limits apply to every result.
          </DialogDescription>
        </DialogHeader>

        {configured.length === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
            No AI provider configured. Add a cloud key or select a local model
            in Settings.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {MODES.map((option) => {
                const Icon = option.icon;
                const active = mode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setMode(option.id);
                      setAlternatives([]);
                    }}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    <span className="flex items-center gap-1.5 font-medium">
                      <Icon className="size-3.5" />
                      {option.label}
                    </span>
                    <span className="text-xs opacity-70">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>

            {mode === "rewrite" && scenes.length > 0 && (
              <div className="grid gap-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Scenes to regenerate</Label>
                    <p className="text-muted-foreground text-xs">
                      Copy and asset locks preserve those parts. Whole-scene
                      locks cannot be selected.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectionOverrides({})}
                  >
                    Select unlocked
                  </Button>
                </div>
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {scenes.map((scene, index) => {
                    const locked = scene.locks?.scene === true;
                    return (
                      <label
                        key={scene.id}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-2 text-sm",
                          locked ? "opacity-55" : "hover:bg-muted",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={!locked && selectedSet.has(scene.id)}
                          disabled={locked}
                          onChange={(event) =>
                            setSelectionOverrides((current) => ({
                              ...current,
                              [scene.id]: event.target.checked,
                            }))
                          }
                          className="accent-primary size-4"
                        />
                        <span className="text-muted-foreground w-16 shrink-0 text-xs">
                          Scene {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {scene.text || "Untitled scene"}
                        </span>
                        {scene.locks?.copy && (
                          <span className="text-muted-foreground text-[10px]">
                            Copy locked
                          </span>
                        )}
                        {scene.locks?.assets && (
                          <span className="text-muted-foreground text-[10px]">
                            Assets locked
                          </span>
                        )}
                        {locked && <Lock className="size-3.5" />}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {mode === "append" && scenes.length > 0 && (
              <div className="grid gap-2">
                <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                  New scenes continue after the existing {scenes.length} and
                  keep the project&apos;s current preset. Undo remains
                  available.
                </p>
                <Label htmlFor="append-media-preference">Automatic media</Label>
                <Combobox
                  id="append-media-preference"
                  value={mediaPreference}
                  onChange={(value) =>
                    setMediaPreference(value as MediaPreference)
                  }
                  options={MEDIA_PREFERENCES.map((value) => ({
                    value,
                    label: MEDIA_PREFERENCE_LABELS[value],
                  }))}
                  searchPlaceholder="Search preferences…"
                />
                <p className="text-muted-foreground text-xs">
                  Image: Pexels → Pixabay → Unsplash. Video: Pexels → Pixabay.
                  No result uses the animated mood background.
                </p>
              </div>
            )}

            {mode === "hook_variants" && openingLocked && (
              <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                Scene 1 copy is locked. You can compare ideas, then unlock it in
                the inspector before applying one.
              </p>
            )}

            <div className="grid gap-2">
              <Label htmlFor="ai-brief">
                {mode === "append"
                  ? "What should the new scenes cover?"
                  : mode === "hook_variants"
                    ? "What should the opening promise?"
                    : "How should the selected scenes improve?"}
              </Label>
              <Textarea
                id="ai-brief"
                rows={3}
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                placeholder={
                  mode === "append"
                    ? "e.g. Common mistakes and how to avoid them"
                    : mode === "hook_variants"
                      ? "e.g. Help first-time creators publish a polished reel"
                      : "e.g. Make the explanation clearer and more specific"
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>Voice script</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    id: "short" as const,
                    label: "Short",
                    description: "One concise line for both display and voice.",
                  },
                  {
                    id: "detailed" as const,
                    label: "Detailed",
                    description:
                      "Scannable display copy with a fuller narration.",
                  },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setScriptStyle(option.id)}
                    className={cn(
                      "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      scriptStyle === option.id
                        ? "border-primary bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    <span className="font-medium">{option.label}</span>
                    <span className="text-xs opacity-70">
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div
              className={cn("grid gap-3", mode === "append" && "grid-cols-2")}
            >
              <div className="grid gap-2">
                <Label htmlFor="ai-provider">Provider</Label>
                <Combobox
                  id="ai-provider"
                  value={effectiveProvider ?? ""}
                  onChange={(value) => setProviderId(value as AIProviderId)}
                  options={configured.map((provider) => ({
                    value: provider.id,
                    label: provider.label,
                  }))}
                  placeholder="Select provider…"
                  searchPlaceholder="Search providers…"
                />
              </div>
              {mode === "append" && (
                <div className="grid gap-2">
                  <Label htmlFor="ai-count">New scenes</Label>
                  <Combobox
                    id="ai-count"
                    value={sceneCount}
                    onChange={setSceneCount}
                    options={countOptions}
                    searchPlaceholder="Search…"
                  />
                </div>
              )}
            </div>

            {mode === "hook_variants" && alternatives.length > 0 && (
              <div className="grid gap-2">
                <Label>Choose an opening</Label>
                {alternatives.map((alternative, index) => (
                  <div
                    key={`${alternative.text}-${index}`}
                    className="grid gap-2 rounded-lg border p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-xs font-medium">
                          Option {index + 1}
                        </p>
                        <p className="mt-1 text-sm font-medium">
                          {alternative.text}
                        </p>
                        {alternative.spokenText && (
                          <p className="text-muted-foreground mt-1 text-xs">
                            Voice: {alternative.spokenText}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={openingLocked || updateScene.isPending}
                        onClick={() => applyAlternative(alternative)}
                      >
                        Use this
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit || pending}>
            {enhance.isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles />
                {mode === "rewrite"
                  ? `Rewrite ${validSelectedIds.length} scenes`
                  : mode === "append"
                    ? "Add scenes"
                    : alternatives.length
                      ? "Generate new ideas"
                      : "Generate hook ideas"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
