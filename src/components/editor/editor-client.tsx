"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Video, Loader2 } from "lucide-react";
import type { PlayerRef } from "@remotion/player";

import {
  useScript,
  useAddScene,
  useUpdateScene,
  useDeleteScene,
  useReorderScenes,
} from "@/hooks/script";
import { useCreateRender } from "@/hooks/renders";
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

export function EditorClient({ scriptId }: { scriptId: string }) {
  const { data: script, isLoading, isError, error } = useScript(scriptId);

  const addScene = useAddScene(scriptId);
  const updateScene = useUpdateScene(scriptId);
  const deleteScene = useDeleteScene(scriptId);
  const reorder = useReorderScenes(scriptId);
  const createRender = useCreateRender();

  const [selectedSceneId, setSelectedSceneId] = React.useState<string | null>(null);
  const [selectedTakeId, setSelectedTakeId] = React.useState<string | null>(null);
  const [previewMode, setPreviewMode] = React.useState<"scene" | "reel">("scene");
  const playerRef = React.useRef<PlayerRef>(null);

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

  const scenes = script.scenes;
  const effectiveSceneId =
    selectedSceneId && scenes.some((s) => s.id === selectedSceneId)
      ? selectedSceneId
      : (scenes[0]?.id ?? null);
  const selectedScene = scenes.find((s) => s.id === effectiveSceneId) ?? null;

  const effectiveTakeId =
    selectedTakeId && script.takes.some((t) => t.id === selectedTakeId)
      ? selectedTakeId
      : (script.takes[0]?.id ?? null);
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
  const timeline = selectedTake?.timeline ?? estimated.timeline;
  const totalFrames = selectedTake?.totalFrames ?? estimated.totalFrames;
  const fps = selectedTake?.fps ?? script.fps;
  const audioUrl = selectedTake?.audioUrl;

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
        <Button
          size="sm"
          disabled={createRender.isPending || scenes.length === 0}
          onClick={() =>
            createRender.mutate({
              scriptId,
              voiceTakeId: effectiveTakeId ?? undefined,
            })
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
                    autoPlay
                    loop
                  />
                ) : (
                  <ReelPlayer
                    scenes={[]}
                    timeline={[]}
                    totalFrames={1}
                    fps={fps}
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
            onSelectTake={setSelectedTakeId}
            hasScenes={scenes.length > 0}
          />
        </CardContent>
      </Card>
    </div>
  );
}
