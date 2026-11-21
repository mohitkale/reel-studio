"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  EditHistory,
  useRestoringEditHistory,
} from "@/components/editor/edit-history";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  useAutoSoundtrack,
  useDeleteScene,
  useReorderScenes,
  useScript,
  useSetScriptMusic,
  useSetScriptVisualStyle,
  useUpdateScene,
} from "@/hooks/script";
import { apiPost } from "@/lib/api-client";
import type { SceneDTO } from "@/lib/dto";
import {
  moveScene,
  moveSceneTo,
  sceneStripChanged,
  toUndoScene,
} from "@/lib/scene-strip";
import { templateName } from "@/video/templates";
import { THEMES } from "@/video/themes";
import { STYLE_META, isStyleId } from "@/video/visual-style";
import { ResultScenePicker } from "./result-scene-picker";

/**
 * Change a finished video without opening the editor (roadmap U4): fix a word,
 * move or delete a scene, pick another look, drop the music, undo, then make the
 * video again. Nothing is made until "Update video" is pressed, so edits are free.
 */
export function ChangeVideo({
  jobId,
  scriptId,
  proposing = false,
  onRegenerate,
}: {
  jobId: string;
  scriptId: string;
  proposing?: boolean;
  onRegenerate?: (scene: SceneDTO, index: number) => void;
}) {
  const router = useRouter();
  const script = useScript(scriptId);
  const update = useUpdateScene(scriptId);
  const remove = useDeleteScene(scriptId);
  const reorder = useReorderScenes(scriptId);
  const restoring = useRestoringEditHistory(scriptId);
  const setStyle = useSetScriptVisualStyle(scriptId);
  const setMusic = useSetScriptMusic(scriptId);
  const autoMusic = useAutoSoundtrack(scriptId);
  const [themeOpen, setThemeOpen] = React.useState(false);
  const [dragged, setDragged] = React.useState<string>();
  const [picker, setPicker] = React.useState<{
    id: string;
    mode: "type" | "media";
  }>();
  const scenes = React.useMemo(
    () => [...(script.data?.scenes ?? [])].sort((a, b) => a.order - b.order),
    [script.data?.scenes],
  );
  const [snapshot, setSnapshot] = React.useState<{
    scenes: ReturnType<typeof toUndoScene>[];
    styleId: string;
    themeId: string | undefined;
    musicUrl: string | null;
  }>();
  if (!snapshot && script.data && scenes.length > 0)
    setSnapshot({
      scenes: scenes.map(toUndoScene),
      styleId: script.data.styleId,
      themeId: script.data.brandTokens.themeId,
      musicUrl: script.data.musicUrl,
    });

  const make = useMutation({
    mutationFn: () =>
      apiPost<{ job: { id: string } }>(
        `/api/production-jobs/${jobId}/produce-current`,
        {},
      ),
    onSuccess: ({ job }) => {
      toast.success("Making the updated video");
      router.push(`/results/${job.id}?from=${encodeURIComponent(jobId)}`);
    },
    onError: (error) =>
      toast.error("Could not start the update", { description: error.message }),
  });

  if (script.isLoading) return null;
  if (!script.data || scenes.length === 0) return null;

  const changed =
    snapshot &&
    (snapshot.styleId !== script.data.styleId ||
      snapshot.themeId !== script.data.brandTokens.themeId ||
      snapshot.musicUrl !== script.data.musicUrl ||
      sceneStripChanged(snapshot.scenes, scenes));
  const saving =
    update.isPending ||
    remove.isPending ||
    reorder.isPending ||
    setStyle.isPending ||
    setMusic.isPending ||
    autoMusic.isPending;
  const busy = saving || restoring || make.isPending || proposing;
  const editingScene = picker && scenes.find((scene) => scene.id === picker.id);
  const onError = (error: Error) =>
    toast.error("That change did not save", { description: error.message });
  const applyPicker = { onSuccess: () => setPicker(undefined), onError };

  return (
    <section aria-labelledby="change-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="change-title" className="text-lg font-semibold">
          Change it
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            Look
            <NativeSelect
              aria-label="Look"
              className="w-44"
              disabled={busy}
              value={script.data.styleId}
              onChange={(event) => {
                if (!isStyleId(event.target.value)) return;
                setStyle.mutate({ styleId: event.target.value }, { onError });
              }}
            >
              {STYLE_META.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.label}
                </option>
              ))}
            </NativeSelect>
          </label>
          <Dialog open={themeOpen} onOpenChange={setThemeOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={busy}>
                Theme
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogTitle>Choose a theme</DialogTitle>
              <DialogDescription>
                Change the palette and type across this video.
              </DialogDescription>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {THEMES.map((theme) => (
                  <Button
                    key={theme.id}
                    variant="outline"
                    aria-pressed={script.data?.brandTokens.themeId === theme.id}
                    disabled={busy}
                    onClick={() =>
                      setStyle.mutate(
                        { themeId: theme.id },
                        {
                          onSuccess: () => setThemeOpen(false),
                          onError,
                        },
                      )
                    }
                    className="h-auto flex-col items-start gap-2 p-2 text-left whitespace-normal"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-full items-center rounded px-2 text-xl font-bold"
                      style={{
                        backgroundColor: theme.palette.background,
                        color: theme.palette.foreground,
                      }}
                    >
                      Aa{" "}
                      <span
                        className="ml-auto size-3 rounded-full"
                        style={{ backgroundColor: theme.palette.accent }}
                      />
                    </span>
                    {theme.name}
                  </Button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => {
              if (script.data?.musicUrl)
                setMusic.mutate({ musicUrl: null }, { onError });
              else if (snapshot?.musicUrl)
                setMusic.mutate({ musicUrl: snapshot.musicUrl }, { onError });
              else autoMusic.mutate(undefined, { onError });
            }}
          >
            {script.data.musicUrl ? "Remove music" : "Add music"}
          </Button>
          <EditHistory
            scriptId={scriptId}
            disabled={saving || make.isPending || proposing}
          />
          <Button
            size="sm"
            disabled={!changed || busy || make.isPending}
            onClick={() => make.mutate()}
          >
            {make.isPending && (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            )}
            Update video
          </Button>
        </div>
      </div>
      <ol
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        aria-label="Scene strip"
      >
        {scenes.map((scene, index) => (
          <li
            key={scene.id}
            className={`space-y-2 rounded-lg border p-3 ${dragged === scene.id ? "opacity-50" : ""}`}
            onDragOver={(event) => {
              if (!busy && dragged && dragged !== scene.id)
                event.preventDefault();
            }}
            onDrop={(event) => {
              if (busy || !dragged || dragged === scene.id) return;
              event.preventDefault();
              setDragged(undefined);
              reorder.mutate(
                moveSceneTo(
                  scenes.map((item) => item.id),
                  dragged,
                  scene.id,
                ),
                { onError },
              );
            }}
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                Scene {index + 1} · {templateName(scene.templateId)}
              </span>
              <span className="flex gap-1">
                <span
                  draggable={!busy && scenes.length > 1}
                  aria-hidden="true"
                  data-testid={`drag-scene-${index + 1}`}
                  className="text-muted-foreground inline-flex size-7 cursor-grab items-center justify-center active:cursor-grabbing"
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", scene.id);
                    setDragged(scene.id);
                  }}
                  onDragEnd={() => setDragged(undefined)}
                >
                  <GripVertical className="size-3.5" />
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  aria-label={`Move scene ${index + 1} up`}
                  disabled={index === 0 || busy}
                  onClick={() =>
                    reorder.mutate(
                      moveScene(
                        scenes.map((s) => s.id),
                        index,
                        -1,
                      ),
                      { onError },
                    )
                  }
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  aria-label={`Move scene ${index + 1} down`}
                  disabled={index === scenes.length - 1 || busy}
                  onClick={() =>
                    reorder.mutate(
                      moveScene(
                        scenes.map((s) => s.id),
                        index,
                        1,
                      ),
                      { onError },
                    )
                  }
                >
                  <ArrowDown className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive size-7"
                  aria-label={`Delete scene ${index + 1}`}
                  disabled={scenes.length <= 1 || busy}
                  onClick={() => remove.mutate(scene.id, { onError })}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </span>
            </div>
            <Textarea
              aria-label={`Scene ${index + 1} text on screen`}
              defaultValue={scene.text}
              key={`${scene.id}-${scene.text}`}
              rows={2}
              maxLength={2000}
              onBlur={(event) => {
                const value = event.target.value.trim();
                if (value && value !== scene.text)
                  update.mutate({ id: scene.id, text: value }, { onError });
              }}
            />
            <Textarea
              aria-label={`Scene ${index + 1} narration`}
              placeholder="Narration is the same as the text"
              defaultValue={scene.spokenText ?? ""}
              key={`${scene.id}-spoken-${scene.spokenText ?? ""}`}
              rows={2}
              maxLength={4000}
              onBlur={(event) => {
                const value = event.target.value.trim();
                if (value !== (scene.spokenText ?? ""))
                  update.mutate(
                    { id: scene.id, spokenText: value || null },
                    { onError },
                  );
              }}
            />
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={busy || scene.locks?.scene}
                onClick={() => setPicker({ id: scene.id, mode: "type" })}
              >
                Scene type
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={busy || scene.locks?.scene || scene.locks?.assets}
                onClick={() => setPicker({ id: scene.id, mode: "media" })}
              >
                Media
              </Button>
              {onRegenerate && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || scene.locks?.scene || scene.locks?.copy}
                  onClick={() => onRegenerate(scene, index)}
                >
                  Regenerate copy
                </Button>
              )}
            </div>
          </li>
        ))}
      </ol>
      {picker && editingScene && (
        <ResultScenePicker
          key={`${editingScene.id}:${picker.mode}`}
          mode={picker.mode}
          scene={editingScene}
          disabled={busy}
          onClose={() => setPicker(undefined)}
          onTemplate={(templateId) =>
            update.mutate(
              { id: editingScene.id, templateId, motion: null },
              applyPicker,
            )
          }
          onMedia={(background) =>
            update.mutate(
              {
                id: editingScene.id,
                background,
                ...(background ? {} : { mediaPreference: "none" }),
              },
              applyPicker,
            )
          }
        />
      )}
      <p className="text-muted-foreground text-xs">
        Changes are saved as you go. The video is made again when you press
        Update video.
      </p>
    </section>
  );
}
