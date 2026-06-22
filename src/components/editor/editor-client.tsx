"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Video, Loader2, Sparkles, Undo2 } from "lucide-react";
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
import type { ReelScene } from "@/compositions/types";
import { estimateTimeline } from "@/lib/preview-timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SceneList } from "@/components/editor/scene-list";
import { SceneInspector } from "@/components/editor/scene-inspector";
import { ReelPlayer } from "@/components/editor/reel-player";
import { VoiceoverPanel } from "@/components/editor/voiceover-panel";
import { AIEnhanceDialog } from "@/components/editor/ai-enhance-dialog";
import { Combobox } from "@/components/ui/combobox";

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
  const [selectedTakeId, setSelectedTakeId] = React.useState<string | null>(null);
  // When true, user explicitly cleared the take — don't auto-select the first one
  const [takeCleared, setTakeCleared] = React.useState(false);
  const [previewMode, setPreviewMode] = React.useState<"scene" | "reel">("scene");
  const [aiOpen, setAiOpen] = React.useState(false);
  // Snapshot of scenes taken before an AI enhance — cleared after render or undo
  const [undoSnapshot, setUndoSnapshot] = React.useState<SceneDTO[] | null>(null);
  const playerRef = React.useRef<PlayerRef>(null);

  // Derive early so hotkey handlers can close over up-to-date values via useHotkey's ref pattern.
  const scenes = script?.scenes ?? [];
  const effectiveSceneId =
    selectedSceneId && scenes.some((s) => s.id === selectedSceneId)
      ? selectedSceneId
      : (scenes[0]?.id ?? null);
  const effectiveTakeId = takeCleared
    ? null
    : selectedTakeId && (script?.takes ?? []).some((t) => t.id === selectedTakeId)
    ? selectedTakeId
    : (script?.takes[0]?.id ?? null);

  function selectTake(id: string) {
    setSelectedTakeId(id);
    setTakeCleared(false);
  }

  function clearTake() {
    setSelectedTakeId(null);
    setTakeCleared(true);
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
        <div className="grid gap-4 lg:grid-cols-[18rem_1fr_20rem]">
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
  }));
  const estimated = estimateTimeline(
    scenes.map((s) => ({ id: s.id, text: s.text })),
    script.fps,
  );
  const fps = selectedTake?.fps ?? script.fps;
  const audioUrl = selectedTake?.audioUrl;

  // When new scenes are added after a take was recorded, blend: use take timing for
  // covered scenes and estimated timing for any new scenes appended afterward.
  const coveredByTake = new Set((selectedTake?.timeline ?? []).map((b) => b.sceneId));
  const allScenesCovered =
    !selectedTake || scenes.every((s) => coveredByTake.has(s.id));

  let timeline: typeof estimated.timeline;
  let totalFrames: number;
  if (!selectedTake) {
    timeline = estimated.timeline;
    totalFrames = estimated.totalFrames;
  } else if (allScenesCovered) {
    timeline = selectedTake.timeline;
    totalFrames = selectedTake.totalFrames;
  } else {
    const uncovered = scenes.filter((s) => !coveredByTake.has(s.id));
    const extra = estimateTimeline(
      uncovered.map((s) => ({ id: s.id, text: s.text })),
      fps,
    );
    timeline = [
      ...selectedTake.timeline,
      ...extra.timeline.map((b) => ({
        ...b,
        startFrame: b.startFrame + selectedTake.totalFrames,
      })),
    ];
    totalFrames = selectedTake.totalFrames + extra.totalFrames;
  }

  // Single-scene loop preview so template/text edits animate instantly.
  const selectedReelScene: ReelScene | null = selectedScene
    ? {
        id: selectedScene.id,
        templateId: normalizeTemplateId(selectedScene.templateId),
        text: selectedScene.text,
        emphasis: selectedScene.emphasis,
        visual: selectedScene.visual,
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
    if (beat) playerRef.current?.seekTo(beat.startFrame);
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
              {selectedTake ? " · previewing take audio" : " · estimated timing"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-36">
            <Combobox
              value={script.brandKitId ?? ""}
              onChange={(v) =>
                assignBrandKit.mutate({
                  projectId: script.projectId,
                  brandKitId: v || null,
                })
              }
              options={[
                { value: "", label: "Default kit" },
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

      <div className="grid gap-4 lg:grid-cols-[18rem_1fr_20rem]">
        <Card>
          <CardContent className="h-[34rem] p-3">
            <SceneList
              scenes={scenes}
              selectedId={effectiveSceneId}
              onSelect={selectScene}
              onAdd={() => addScene.mutate("")}
              onMove={handleMove}
              onDelete={(id) => deleteScene.mutate(id)}
              busy={sceneBusy}
            />
          </CardContent>
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
                    loop
                    tokens={script.brandTokens}
                  />
                ) : (
                  <ReelPlayer
                    scenes={[]}
                    timeline={[]}
                    totalFrames={1}
                    fps={fps}
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
                  totalFrames={totalFrames}
                  fps={fps}
                  audioUrl={audioUrl}
                  tokens={script.brandTokens}
                />
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  {selectedTake
                    ? "Playing the selected take with synced captions."
                    : "Estimated preview. Generate a take below for exact, audio-synced timing."}
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            {selectedScene ? (
              <SceneInspector
                key={selectedScene.id}
                scene={selectedScene}
                onUpdate={(vars) => updateScene.mutate(vars)}
                onDelete={(id) => deleteScene.mutate(id)}
                saving={updateScene.isPending}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Add a scene to start editing.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <VoiceoverPanel
            scriptId={scriptId}
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
    </div>
  );
}
