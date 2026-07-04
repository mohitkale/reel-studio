"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Video, Loader2, Sparkles, Undo2, Braces, ChevronDown, Eye, EyeOff, BarChart2, Gauge, Zap, Gem } from "lucide-react";

import { ORIENTATIONS, ORIENTATION_LABELS, type Orientation } from "@/lib/orientation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { PlayerRef } from "@remotion/player";

import {
  useScript,
  useAddScene,
  useUpdateScene,
  useDeleteScene,
  useReorderScenes,
  useUndoScript,
  useSetScriptHideText,
  useSetScriptHideProgressBar,
} from "@/hooks/script";
import type { SceneDTO } from "@/lib/dto";
import { useCreateRender, useRenderProgress } from "@/hooks/renders";
import { useBrandKits, useAssignBrandKit } from "@/hooks/brandkits";
import { useHotkey } from "@/hooks/use-hotkeys";
import { normalizeTemplateId } from "@/compositions/templates";
import { type ReelScene, coverFrames } from "@/compositions/types";
import { estimateTimeline } from "@/lib/preview-timeline";
import { resolveReelTimeline } from "@/lib/reel-timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SceneList } from "@/components/editor/scene-list";
import { SceneInspector } from "@/components/editor/scene-inspector";
import { ReelPlayer } from "@/components/editor/reel-player";
import { VoiceoverPanel } from "@/components/editor/voiceover-panel";
import { AIEnhanceDialog } from "@/components/editor/ai-enhance-dialog";
import { ScenesJsonDialog } from "@/components/editor/scenes-json-dialog";
import { CoverControl } from "@/components/editor/cover-control";
import { MusicControl } from "@/components/editor/music-control";
import { CaptionsMenu } from "@/components/editor/captions-menu";
import { Combobox } from "@/components/ui/combobox";
import { HintTooltip } from "@/components/ui/hint-tooltip";

/** Sentinel stored when the user explicitly clears the take (vs. never choosing). */
const TAKE_CLEARED = "__cleared__";
const takeKey = (scriptId: string) => `reel-studio:selected-take:${scriptId}`;

export function EditorClient({ scriptId }: { scriptId: string }) {
  const { data: script, isLoading, isError, error } = useScript(scriptId);

  const addScene = useAddScene(scriptId);
  const updateScene = useUpdateScene(scriptId);
  const deleteScene = useDeleteScene(scriptId);
  const reorder = useReorderScenes(scriptId);
  const createRender = useCreateRender();
  const undoScript = useUndoScript(scriptId);
  const setHideText = useSetScriptHideText(scriptId);
  const setHideProgressBar = useSetScriptHideProgressBar(scriptId);
  const { data: brandKits = [] } = useBrandKits();
  const assignBrandKit = useAssignBrandKit();

  const [selectedSceneId, setSelectedSceneId] = React.useState<string | null>(null);
  // Take selection persists per-script across refreshes (lazy init from
  // localStorage; avoids re-deriving in an effect).
  const [selectedTakeId, setSelectedTakeId] = React.useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const v = window.localStorage.getItem(takeKey(scriptId));
    return v && v !== TAKE_CLEARED ? v : null;
  });
  // When true, user explicitly cleared the take — don't auto-select the first one
  const [takeCleared, setTakeCleared] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(takeKey(scriptId)) === TAKE_CLEARED;
  });
  const [previewMode, setPreviewMode] = React.useState<"scene" | "reel">("scene");
  // Editor-only preview fidelity: "draft" trims expensive effects for smoother
  // scrubbing on lower-end machines. Never affects the final render.
  const [previewQuality, setPreviewQuality] = React.useState<"standard" | "draft">("standard");
  const [aiOpen, setAiOpen] = React.useState(false);
  const [jsonOpen, setJsonOpen] = React.useState(false);
  // Snapshot of scenes taken before an AI enhance — cleared after render or undo
  const [undoSnapshot, setUndoSnapshot] = React.useState<SceneDTO[] | null>(null);
  const playerRef = React.useRef<PlayerRef>(null);

  // Inline render progress: track the most recently queued render from this
  // editor session so the toolbar can show live % instead of only a toast +
  // link to /renders. Cleared once the job finishes (done or error).
  const [activeRender, setActiveRender] = React.useState<{
    id: string;
    label: string;
    progress: number;
    status: string;
  } | null>(null);
  const handleActiveRenderUpdate = React.useCallback(
    (data: { progress: number; status: string }) => {
      setActiveRender((prev) =>
        prev ? { ...prev, progress: data.progress, status: data.status } : prev,
      );
    },
    [],
  );
  const activeRenderIsLive =
    activeRender?.status === "queued" ||
    activeRender?.status === "bundling" ||
    activeRender?.status === "rendering";
  useRenderProgress(
    activeRender && activeRenderIsLive ? activeRender.id : null,
    handleActiveRenderUpdate,
  );

  // Derive early so hotkey handlers can close over up-to-date values via useHotkey's ref pattern.
  // Memoized so `?? []` doesn't hand useMemo hooks below a new array identity every render.
  const scenes = React.useMemo(() => script?.scenes ?? [], [script?.scenes]);
  const effectiveSceneId =
    selectedSceneId && scenes.some((s) => s.id === selectedSceneId)
      ? selectedSceneId
      : (scenes[0]?.id ?? null);
  const selectedScene = scenes.find((s) => s.id === effectiveSceneId) ?? null;

  // Reel input: scene templates + timeline. Memoized (and computed before any
  // early return, per rules of hooks) so the Player only sees a new array
  // reference when a scene actually changes, not on every unrelated re-render.
  const reelScenes: ReelScene[] = React.useMemo(
    () =>
      scenes.map((s) => ({
        id: s.id,
        templateId: normalizeTemplateId(s.templateId),
        text: s.text,
        emphasis: s.emphasis,
        visual: s.visual,
        background: s.background,
        items: s.items,
        // Per-scene override wins; otherwise the script-wide default.
        hideText: s.hideText ?? script?.hideText,
        mood: s.mood as ReelScene["mood"],
        order: s.order,
      })),
    [scenes, script?.hideText],
  );
  // Single-scene loop preview so template/text edits animate instantly.
  const selectedReelScene: ReelScene | null = React.useMemo(
    () =>
      selectedScene
        ? {
            id: selectedScene.id,
            templateId: normalizeTemplateId(selectedScene.templateId),
            text: selectedScene.text,
            emphasis: selectedScene.emphasis,
            visual: selectedScene.visual,
            background: selectedScene.background,
            items: selectedScene.items,
            hideText: selectedScene.hideText ?? script?.hideText,
            mood: selectedScene.mood as ReelScene["mood"],
            order: selectedScene.order,
          }
        : null,
    [selectedScene, script?.hideText, scenes],
  );
  // A take stays valid as long as its spoken text still matches the script
  // (resolveReelTimeline matches by text, so background/template/effect edits
  // never invalidate it). Auto-pick the most recent *usable* take; a take whose
  // script changed falls back to estimated, silent timing instead of producing a
  // broken, desynced timeline.
  const sceneTexts = scenes.map((s) => ({ id: s.id, text: s.text }));
  const allTakes = script?.takes ?? [];
  const usableTakes = allTakes.filter(
    (t) => resolveReelTimeline(sceneTexts, t, t.fps).takeUsable,
  );
  const effectiveTakeId = takeCleared
    ? null
    : selectedTakeId && usableTakes.some((t) => t.id === selectedTakeId)
    ? selectedTakeId
    : (usableTakes[0]?.id ?? null);

  function selectTake(id: string) {
    setSelectedTakeId(id);
    setTakeCleared(false);
    if (typeof window !== "undefined")
      window.localStorage.setItem(takeKey(scriptId), id);
  }

  function clearTake() {
    setSelectedTakeId(null);
    setTakeCleared(true);
    if (typeof window !== "undefined")
      window.localStorage.setItem(takeKey(scriptId), TAKE_CLEARED);
  }

  // Editor keyboard shortcuts — hooks must be called unconditionally.
  useHotkey("n", () => addScene.mutate(""), { enabled: !!script });
  useHotkey("j", () => {
    const idx = scenes.findIndex((s) => s.id === effectiveSceneId);
    const next = scenes[idx + 1];
    if (next) setSelectedSceneId(next.id);
  }, { enabled: !!script });
  useHotkey("k", () => {
    const idx = scenes.findIndex((s) => s.id === effectiveSceneId);
    const prev = scenes[idx - 1];
    if (prev) setSelectedSceneId(prev.id);
  }, { enabled: !!script });
  useHotkey("R", () => {
    if (!scenes.length || createRender.isPending) return;
    createRender.mutate({ scriptId, voiceTakeId: effectiveTakeId ?? undefined });
  }, { ctrl: true, shift: true, enabled: !!script });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {/* Mirror the real editor: a toolbar row, then 3 equal columns, then the
            full-width voiceover panel. */}
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-72" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !script) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">
          Could not load this script. {(error as Error)?.message}
        </CardContent>
      </Card>
    );
  }

  const selectedTake = script.takes.find((t) => t.id === effectiveTakeId) ?? null;

  // Reconcile the take with the current scenes by spoken text (see
  // resolveReelTimeline): non-text edits keep it; a changed script falls back to
  // estimated timing. Beats are remapped onto current scene ids for rendering.
  const fps = selectedTake?.fps ?? script.fps;
  const resolved = resolveReelTimeline(sceneTexts, selectedTake, fps);
  const takeUsable = resolved.takeUsable;
  const timeline = resolved.timeline;
  const totalFrames = resolved.totalFrames;
  const audioUrl = takeUsable && selectedTake ? selectedTake.audioUrl : undefined;
  // Full-reel preview holds the cover at the start, shifting everything by this much.
  const coverFr = coverFrames(fps, !!script.coverUrl);

  const sceneBeat = selectedScene
    ? timeline.find((b) => b.sceneId === selectedScene.id)
    : undefined;
  const sceneDuration =
    sceneBeat?.durationFrames ??
    (selectedScene
      ? estimateTimeline([{ id: selectedScene.id, text: selectedScene.text }], fps)
          .totalFrames
      : 1);

  function selectScene(id: string) {
    setSelectedSceneId(id);
    const beat = timeline.find((b) => b.sceneId === id);
    if (beat) playerRef.current?.seekTo(beat.startFrame + coverFr);
  }

  function handleMove(id: string, direction: -1 | 1) {
    const ids = scenes.map((s) => s.id);
    const idx = ids.indexOf(id);
    const j = idx + direction;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    reorder.mutate(ids);
  }

  const sceneBusy = reorder.isPending || addScene.isPending || deleteScene.isPending;

  // Queue a render at the script's native orientation, or repurpose into another
  // format. Multiple formats simply queue several jobs (the server runs them
  // within its concurrency cap). `quality` trades resolution for speed: draft
  // is a near-instant low-fidelity export, high is a crisper final delivery.
  function queueRender(orientation?: Orientation, quality?: "draft" | "standard" | "high") {
    createRender.mutate(
      {
        scriptId,
        voiceTakeId: effectiveTakeId ?? undefined,
        ...(orientation ? { orientation } : {}),
        ...(quality && quality !== "standard" ? { quality } : {}),
      },
      {
        onSuccess: (render) => {
          setUndoSnapshot(null); // can't undo after a render
          const labelParts = [
            orientation ? ORIENTATION_LABELS[orientation] : null,
            quality === "draft" ? "draft" : quality === "high" ? "high quality" : null,
          ].filter(Boolean);
          const label = labelParts.length ? labelParts.join(" · ") : "Render";
          setActiveRender({ id: render.id, label, progress: 0, status: render.status });
          toast.success(labelParts.length ? `Queued ${labelParts.join(" · ")}` : "Render queued", {
            description: "Track progress on the Renders page.",
            action: {
              label: "View",
              onClick: () => {
                window.location.href = "/renders";
              },
            },
          });
        },
        onError: () => toast.error("Failed to queue render"),
      },
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Back to projects"
          >
            <HintTooltip label="Back to projects" side="bottom">
              <span className="inline-flex">
                <ArrowLeft className="size-4" />
              </span>
            </HintTooltip>
          </Link>
          <div>
            <h2 className="text-lg font-semibold leading-tight">{script.name}</h2>
            <p className="text-xs text-muted-foreground">
              {scenes.length} scenes · {script.fps} fps
              {takeUsable ? " · previewing take audio" : " · estimated timing"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <HintTooltip
            label="Choose a brand kit for colors, handle, and fonts. Leave on Default to use the starred kit."
            side="bottom"
          >
            <div className="w-44">
              <Combobox
                value={script.brandKitId ?? ""}
                onChange={(v) =>
                  assignBrandKit.mutate({
                    projectId: script.projectId,
                    brandKitId: v || null,
                  })
                }
                options={[
                  {
                    value: "",
                    label: brandKits.find((k) => k.isDefault)
                      ? `Default (${brandKits.find((k) => k.isDefault)!.name})`
                      : "Default kit",
                  },
                  ...brandKits.map((k) => ({ value: k.id, label: k.name })),
                ]}
                placeholder="Default kit"
                searchPlaceholder="Search kits…"
              />
            </div>
          </HintTooltip>
          {undoSnapshot && (
            <HintTooltip label="Restore scenes to how they were before the last AI change" side="bottom">
              <Button
                size="sm"
                variant="ghost"
                disabled={undoScript.isPending}
                onClick={() =>
                  undoScript.mutate(
                    undoSnapshot.map((s) => ({
                      templateId: s.templateId,
                      text: s.text,
                      emphasis: s.emphasis,
                      visual: s.visual ?? null,
                      background: s.background ?? null,
                      items: s.items,
                      mood: s.mood,
                      musicMood: s.musicMood,
                    })),
                    {
                      onSuccess: () => {
                        setUndoSnapshot(null);
                        toast.success("Scenes restored", {
                          description: "Rolled back to the version before AI changes.",
                        });
                      },
                      onError: () => toast.error("Undo failed"),
                    },
                  )
                }
              >
                {undoScript.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Undo2 className="size-3.5" />
                )}
                Undo AI
              </Button>
            </HintTooltip>
          )}
          <CoverControl scriptId={scriptId} coverUrl={script.coverUrl} />
          <MusicControl
            scriptId={scriptId}
            musicUrl={script.musicUrl}
            musicVolume={script.musicVolume}
            scenes={scenes}
          />
          <HintTooltip
            label={
              script.hideText
                ? "On-screen text is hidden on all scenes (per-scene overrides still apply)"
                : "Hide on-screen text on all scenes — show background only"
            }
            side="bottom"
          >
          <Button
            size="sm"
            variant={script.hideText ? "default" : "outline"}
            onClick={() => setHideText.mutate(!script.hideText)}
          >
            {script.hideText ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
            {script.hideText ? "Text hidden" : "Show text"}
          </Button>
          </HintTooltip>
          <HintTooltip
            label={
              script.hideProgressBar
                ? "Progress bar is hidden on all scenes"
                : "Show or hide the thin progress bar at the top of each scene"
            }
            side="bottom"
          >
          <Button
            size="sm"
            variant={script.hideProgressBar ? "default" : "outline"}
            onClick={() => setHideProgressBar.mutate(!script.hideProgressBar)}
          >
            <BarChart2 className="size-3.5" />
            {script.hideProgressBar ? "Progress hidden" : "Show progress"}
          </Button>
          </HintTooltip>
          <HintTooltip
            label={
              previewQuality === "draft"
                ? "Draft preview: lighter effects for smoother scrubbing. Final render is unaffected."
                : "Switch to a lighter draft preview for smoother scrubbing on slower machines"
            }
            side="bottom"
          >
          <Button
            size="sm"
            variant={previewQuality === "draft" ? "default" : "outline"}
            onClick={() =>
              setPreviewQuality((q) => (q === "draft" ? "standard" : "draft"))
            }
          >
            <Gauge className="size-3.5" />
            {previewQuality === "draft" ? "Draft preview" : "Full preview"}
          </Button>
          </HintTooltip>
          <HintTooltip label="Edit scenes as JSON — templates, text, backgrounds, and moods" side="bottom">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setJsonOpen(true)}
          >
            <Braces className="size-3.5" />
            JSON
          </Button>
          </HintTooltip>
          <CaptionsMenu
            scriptId={scriptId}
            takeId={effectiveTakeId}
            disabled={scenes.length === 0}
          />
          <HintTooltip label="Rewrite or append scenes with AI storyboarding" side="bottom">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAiOpen(true)}
          >
            <Sparkles className="size-3.5" />
            AI
          </Button>
          </HintTooltip>
          {activeRenderIsLive && activeRender ? (
            <HintTooltip
              label={`${activeRender.label}: ${activeRender.status} — open Renders page`}
              side="bottom"
            >
              <Link
                href="/renders"
                className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <Loader2 className="size-3.5 shrink-0 animate-spin" />
                <span className="whitespace-nowrap">
                  {activeRender.status === "bundling"
                    ? "Bundling…"
                    : `${Math.round(activeRender.progress * 100)}%`}
                </span>
                <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.round(activeRender.progress * 100)}%` }}
                  />
                </span>
              </Link>
            </HintTooltip>
          ) : null}
          <div className="flex items-center">
            <HintTooltip label="Export the reel as MP4 at standard quality" side="bottom">
            <Button
              size="sm"
              className="rounded-r-none"
              disabled={createRender.isPending || scenes.length === 0}
              onClick={() => queueRender()}
            >
              {createRender.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Video className="size-3.5" />
              )}
              Render
            </Button>
            </HintTooltip>
            <DropdownMenu>
              <HintTooltip label="Render options — draft, high quality, or other formats" side="bottom">
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  className="rounded-l-none border-l border-l-primary-foreground/20 px-1.5"
                  disabled={createRender.isPending || scenes.length === 0}
                  aria-label="Render in another format"
                >
                  <ChevronDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              </HintTooltip>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Speed / quality</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => queueRender(undefined, "draft")}>
                  <Zap className="size-3.5" />
                  Quick draft (fastest, lower res)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => queueRender(undefined, "high")}>
                  <Gem className="size-3.5" />
                  High quality (slower, sharper)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Repurpose to format</DropdownMenuLabel>
                {ORIENTATIONS.map((o) => (
                  <DropdownMenuItem key={o} onClick={() => queueRender(o)}>
                    {ORIENTATION_LABELS[o]}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => ORIENTATIONS.forEach((o) => queueRender(o))}
                >
                  All formats
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* The center column (player) defines the row height; the side panels are
          stretched to match it and scroll internally. Their content is absolutely
          positioned so it never contributes to the grid row height. */}
      <div className="grid items-stretch gap-4 lg:grid-cols-3">
        <Card className="relative min-h-[24rem] overflow-hidden">
          <div className="absolute inset-0 overflow-hidden p-3">
            <SceneList
              scenes={scenes}
              selectedId={effectiveSceneId}
              onSelect={selectScene}
              onAdd={() => addScene.mutate("")}
              onMove={handleMove}
              onDelete={(id) => deleteScene.mutate(id)}
              busy={sceneBusy}
            />
          </div>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Tabs
              value={previewMode}
              onValueChange={(v) => setPreviewMode(v as "scene" | "reel")}
            >
              <TabsList className="mb-3 w-full">
                <TabsTrigger value="scene" className="flex-1">
                  This scene
                </TabsTrigger>
                <TabsTrigger value="reel" className="flex-1">
                  Full reel
                </TabsTrigger>
              </TabsList>

              <TabsContent value="scene">
                {selectedReelScene ? (
                  <ReelPlayer
                    key={selectedReelScene.id}
                    scenes={[selectedReelScene]}
                    timeline={[
                      {
                        sceneId: selectedReelScene.id,
                        startFrame: 0,
                        durationFrames: sceneDuration,
                      },
                    ]}
                    totalFrames={sceneDuration}
                    fps={fps}
                    width={script.width}
                    height={script.height}
                    loop
                    tokens={script.brandTokens}
                    hideProgressBar={script.hideProgressBar}
                    previewQuality={previewQuality}
                  />
                ) : (
                  <ReelPlayer
                    scenes={[]}
                    timeline={[]}
                    totalFrames={1}
                    fps={fps}
                    width={script.width}
                    height={script.height}
                    tokens={script.brandTokens}
                  />
                )}
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Looping the selected scene. Template and text edits update live.
                </p>
              </TabsContent>

              <TabsContent value="reel">
                <ReelPlayer
                  ref={playerRef}
                  scenes={reelScenes}
                  timeline={timeline}
                  totalFrames={totalFrames + coverFr}
                  fps={fps}
                  width={script.width}
                  height={script.height}
                  audioUrl={audioUrl}
                  musicUrl={script.musicUrl ?? undefined}
                  musicVolume={script.musicVolume}
                  loop={false}
                  tokens={script.brandTokens}
                  coverUrl={script.coverUrl ?? undefined}
                  hideProgressBar={script.hideProgressBar}
                  previewQuality={previewQuality}
                />
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  {takeUsable
                    ? "Playing the selected take with synced captions."
                    : "Estimated preview. Generate a take below for exact, audio-synced timing."}
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="relative min-h-[24rem] overflow-hidden">
          <div className="absolute inset-0 overflow-y-auto p-4">
            {selectedScene ? (
              <SceneInspector
                key={selectedScene.id}
                scene={selectedScene}
                sceneIndex={scenes.findIndex((s) => s.id === effectiveSceneId)}
                totalScenes={scenes.length}
                onNavigate={(dir) => {
                  const idx = scenes.findIndex((s) => s.id === effectiveSceneId);
                  const next = scenes[idx + dir];
                  if (next) selectScene(next.id);
                }}
                onUpdate={(vars) => updateScene.mutate(vars)}
                onDelete={(id) => deleteScene.mutate(id)}
                saving={updateScene.isPending}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Add a scene to start editing.
              </p>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <VoiceoverPanel
            scriptId={scriptId}
            scenes={scenes.map((s) => ({ id: s.id, text: s.text }))}
            takes={script.takes}
            selectedTakeId={effectiveTakeId}
            onSelectTake={selectTake}
            onClearTake={clearTake}
            hasScenes={scenes.length > 0}
          />
        </CardContent>
      </Card>

      <AIEnhanceDialog
        scriptId={scriptId}
        scriptName={script.name}
        scenes={scenes}
        open={aiOpen}
        onOpenChange={setAiOpen}
        onBeforeEnhance={() => setUndoSnapshot([...scenes])}
        onEnhanceSuccess={clearTake}
      />

      <ScenesJsonDialog
        scriptId={scriptId}
        scenes={scenes}
        open={jsonOpen}
        onOpenChange={setJsonOpen}
      />
    </div>
  );
}
