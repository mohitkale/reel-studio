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
import { prepareSceneAppendScope } from "@/library/scene-append-scope";
import type { SceneDTO } from "@/lib/dto";
import { chapterPlanIssue, type ChapterPlan } from "@/production/chapters";
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
import { Input } from "@/components/ui/input";
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
  chapterPlan,
  open,
  onOpenChange,
  onBeforeEnhance,
  onEnhanceSuccess,
}: {
  scriptId: string;
  scriptName: string;
  scenes: SceneDTO[];
  chapterPlan?: ChapterPlan;
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
  const [chapterId, setChapterId] = React.useState<string>("");
  const [chapterTitle, setChapterTitle] = React.useState("");
  const [alternatives, setAlternatives] = React.useState<AIScene[]>([]);
  const [mediaPreference, setMediaPreference] =
    React.useState<MediaPreference>("auto");

  const configured = (providers ?? []).filter(
    (provider) => provider.configured,
  );
  const effectiveProvider = providerId ?? configured[0]?.id;
  const outlineIssue = chapterPlan
    ? chapterPlanIssue(
        chapterPlan,
        scenes.map((scene) => scene.id),
      )
    : undefined;
  const chapterIndex =
    chapterPlan?.chapters.findIndex((chapter) => chapter.id === chapterId) ??
    -1;
  const scopeValid = !chapterId || (chapterIndex >= 0 && !outlineIssue);
  const first =
    chapterIndex >= 0
      ? scenes.findIndex(
          (scene) =>
            scene.id === chapterPlan!.chapters[chapterIndex].firstSceneId,
        )
      : 0;
  const end =
    chapterIndex >= 0 && chapterIndex + 1 < chapterPlan!.chapters.length
      ? scenes.findIndex(
          (scene) =>
            scene.id === chapterPlan!.chapters[chapterIndex + 1].firstSceneId,
        )
      : scenes.length;
  const scopeScenes = chapterId ? scenes.slice(first, end) : scenes;
  const defaultSelectedIds = new Set(
    scopeScenes
      .filter((scene) => !scene.locks?.scene)
      .slice(0, 20)
      .map((scene) => scene.id),
  );
  const validSelectedIds = scopeScenes
    .filter(
      (scene) =>
        !scene.locks?.scene &&
        (selectionOverrides[scene.id] ?? defaultSelectedIds.has(scene.id)),
    )
    .map((scene) => scene.id);
  const selectedSet = new Set(validSelectedIds);
  const openingLocked =
    scenes[0]?.locks?.scene === true || scenes[0]?.locks?.copy === true;
  let appendIssue: string | undefined;
  if (mode === "append") {
    try {
      prepareSceneAppendScope(
        { scenes, chapterPlan },
        {
          chapterTitle: chapterTitle.trim() || undefined,
          sceneCount: sceneCount === "auto" ? undefined : Number(sceneCount),
        },
      );
    } catch (error) {
      appendIssue =
        error instanceof Error ? error.message : "Update the chapter outline.";
    }
  }

  function submit() {
    const trimmed = brief.trim();
    if (!trimmed || !effectiveProvider) return;
    if (mode === "append" && appendIssue) return;
    if (
      mode === "rewrite" &&
      (!scopeValid ||
        validSelectedIds.length === 0 ||
        validSelectedIds.length > 20)
    )
      return;
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
        chapterId: mode === "rewrite" && chapterId ? chapterId : undefined,
        chapterTitle:
          mode === "append" ? chapterTitle.trim() || undefined : undefined,
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
            mode === "rewrite"
              ? "Selected scenes rewritten"
              : chapterTitle.trim()
                ? "Chapter added"
                : "Scenes added",
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
    (mode !== "rewrite" ||
      (scopeValid &&
        validSelectedIds.length > 0 &&
        validSelectedIds.length <= 20)) &&
    (mode !== "hook_variants" || scenes.length > 0) &&
    (mode !== "append" || !appendIssue);

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
                {chapterPlan && !outlineIssue && (
                  <div className="grid gap-2">
                    <Label htmlFor="ai-rewrite-chapter">Rewrite scope</Label>
                    <select
                      id="ai-rewrite-chapter"
                      className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                      value={chapterId}
                      disabled={pending}
                      onChange={(event) => {
                        setChapterId(event.target.value);
                        setSelectionOverrides({});
                      }}
                    >
                      <option value="">
                        Choose scenes across the storyboard
                      </option>
                      {chapterPlan.chapters.map((chapter) => (
                        <option key={chapter.id} value={chapter.id}>
                          {chapter.title}
                        </option>
                      ))}
                    </select>
                    <p className="text-muted-foreground text-xs">
                      A chapter uses its own copy and neighboring context. Other
                      chapters stay unchanged.
                    </p>
                  </div>
                )}
                {(outlineIssue || !scopeValid) && (
                  <p className="text-destructive text-xs">
                    Update the chapter outline before rewriting that chapter.
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Scenes to regenerate</Label>
                    <p className="text-muted-foreground text-xs">
                      Copy and asset locks preserve those parts. Whole-scene
                      locks cannot be selected. Each rewrite supports up to 20
                      scenes; the first 20 unlocked scenes are selected
                      initially.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectionOverrides({})}
                  >
                    Select up to 20 unlocked
                  </Button>
                </div>
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {scopeScenes.map((scene) => {
                    const index = scenes.findIndex(
                      (item) => item.id === scene.id,
                    );
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
                {validSelectedIds.length > 20 && (
                  <p className="text-destructive text-xs">
                    Choose at most 20 scenes for this rewrite.
                  </p>
                )}
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

            {mode === "append" && (
              <div className="grid gap-2">
                <Label htmlFor="ai-append-chapter">
                  New chapter title (optional)
                </Label>
                <Input
                  id="ai-append-chapter"
                  value={chapterTitle}
                  maxLength={120}
                  disabled={pending || !chapterPlan}
                  onChange={(event) => setChapterTitle(event.target.value)}
                  placeholder="e.g. Common mistakes"
                />
                <p className="text-muted-foreground text-xs">
                  {chapterPlan
                    ? "Name a new chapter, or leave blank to extend the last one. One generation uses up to 20 scenes; Auto asks for 3–5."
                    : "Save a chapter outline in the direction menu to add a named chapter."}
                </p>
                {appendIssue && (
                  <p className="text-destructive text-xs" role="alert">
                    {appendIssue}
                  </p>
                )}
              </div>
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
