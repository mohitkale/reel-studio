"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import {
  useScript,
  useAddScene,
  useUpdateScene,
  useDeleteScene,
  useReorderScenes,
} from "@/hooks/script";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { SceneList } from "@/components/editor/scene-list";
import { SceneInspector } from "@/components/editor/scene-inspector";
import { PreviewFrame } from "@/components/editor/preview-frame";
import { TakePlayer } from "@/components/editor/take-player";
import { VoiceoverPanel } from "@/components/editor/voiceover-panel";

export function EditorClient({ scriptId }: { scriptId: string }) {
  const { data: script, isLoading, isError, error } = useScript(scriptId);

  const addScene = useAddScene(scriptId);
  const updateScene = useUpdateScene(scriptId);
  const deleteScene = useDeleteScene(scriptId);
  const reorder = useReorderScenes(scriptId);

  const [selectedSceneId, setSelectedSceneId] = React.useState<string | null>(null);
  const [selectedTakeId, setSelectedTakeId] = React.useState<string | null>(null);
  const [playingSceneId, setPlayingSceneId] = React.useState<string | null>(null);

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

  // What the preview shows: the playing beat's scene during playback, else the selected scene.
  const previewScene =
    (playingSceneId && scenes.find((s) => s.id === playingSceneId)) ||
    selectedScene;
  const previewIndex = previewScene
    ? scenes.findIndex((s) => s.id === previewScene.id) + 1
    : undefined;

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
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[18rem_1fr_20rem]">
        <Card>
          <CardContent className="h-[28rem] p-3">
            <SceneList
              scenes={scenes}
              selectedId={effectiveSceneId}
              onSelect={setSelectedSceneId}
              onAdd={() => addScene.mutate("")}
              onMove={handleMove}
              onDelete={(id) => deleteScene.mutate(id)}
              busy={sceneBusy}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-4">
            <PreviewFrame
              text={previewScene?.text ?? ""}
              emphasis={previewScene?.emphasis ?? []}
              sceneNumber={previewIndex}
              sceneCount={scenes.length}
              playing={Boolean(playingSceneId)}
            />
            {selectedTake ? (
              <>
                <Separator />
                <TakePlayer
                  take={selectedTake}
                  onActiveSceneChange={setPlayingSceneId}
                />
              </>
            ) : (
              <p className="text-center text-xs text-muted-foreground">
                Generate a take below to preview synced timing.
              </p>
            )}
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
