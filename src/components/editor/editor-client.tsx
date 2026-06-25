"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Video, Loader2, Sparkles, Undo2, Braces } from "lucide-react";
import { toast } from "sonner";
import type { PlayerRef } from "@remotion/player";

import {
  useScript,
  useAddScene,
  useUpdateScene,
  useDeleteScene,
  useReorderScenes,
  useUndoScript,
} from "@/hooks/script";
import type { SceneDTO } from "@/lib/dto";
import { useCreateRender } from "@/hooks/renders";
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
import { Combobox } from "@/components/ui/combobox";

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
  const [aiOpen, setAiOpen] = React.useState(false);
  const [jsonOpen, setJsonOpen] = React.useState(false);
  // Snapshot of scenes taken before an AI enhance — cleared after render or undo
  const [undoSnapshot, setUndoSnapshot] = React.useState<SceneDTO[] | null>(null);
  const playerRef = React.useRef<PlayerRef>(null);

  // Derive early so hotkey handlers can close over up-to-date values via useHotkey's ref pattern.
  const scenes = script?.scenes ?? [];
  const effectiveSceneId =
    selectedSceneId && scenes.some((s) => s.id === selectedSceneId)
      ? selectedSceneId
      : (scenes[0]?.id ?? null);
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
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 lg:grid-cols-[minmax(20rem,1fr)_22rem_22rem]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
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

  const selectedScene = scenes.find((s) => s.id === effectiveSceneId) ?? null;
  const selectedTake = script.takes.find((t) => t.id === effectiveTakeId) ?? null;

  // Reel input: scene templates + timeline (from the take, or estimated for silent preview).
  const reelScenes: ReelScene[] = scenes.map((s) => ({
    id: s.id,
    templateId: normalizeTemplateId(s.templateId),
    text: s.text,
    emphasis: s.emphasis,
    visual: s.visual,
    background: s.background,
    items: s.items,
  }));
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

  // Single-scene loop preview so template/text edits animate instantly.
  const selectedReelScene: ReelScene | null = selectedScene
    ? {
        id: selectedScene.id,
        templateId: normalizeTemplateId(selectedScene.templateId),
        text: selectedScene.text,
        emphasis: selectedScene.emphasis,
        visual: selectedScene.visual,
        background: selectedScene.background,
        items: selectedScene.items,
      }
    : null;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Back to projects"
          >
            <ArrowLeft className="size-4" />
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
          {undoSnapshot && (
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
          )}
          <CoverControl scriptId={scriptId} coverUrl={script.coverUrl} />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setJsonOpen(true)}
          >
            <Braces className="size-3.5" />
            JSON
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAiOpen(true)}
          >
            <Sparkles className="size-3.5" />
            AI
          </Button>
          <Button
            size="sm"
            disabled={createRender.isPending || scenes.length === 0}
            onClick={() =>
              createRender.mutate(
                { scriptId, voiceTakeId: effectiveTakeId ?? undefined },
                {
                  onSuccess: () => {
                    setUndoSnapshot(null); // can't undo after a render
                    toast.success("Render queued", {
                      description: "Track progress on the Renders page.",
                      action: { label: "View", onClick: () => { window.location.href = "/renders"; } },
                    });
                  },
                  onError: () => toast.error("Failed to queue render"),
                },
              )
            }
          >
            {createRender.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Video className="size-3.5" />
            )}
            Render
          </Button>
        </div>
      </div>

      {/* The center column (player) defines the row height; the side panels are
          stretched to match it and scroll internally. Their content is absolutely
          positioned so it never contributes to the grid row height. */}
      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(20rem,1fr)_22rem_22rem]">
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
                  loop={false}
                  tokens={script.brandTokens}
                  coverUrl={script.coverUrl ?? undefined}
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
