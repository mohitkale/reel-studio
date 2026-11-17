"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Loader2, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  useDeleteScene,
  useReorderScenes,
  useScript,
  useSetScriptMusic,
  useSetScriptVisualStyle,
  useUndoScript,
  useUpdateScene,
} from "@/hooks/script";
import { apiPost } from "@/lib/api-client";
import {
  moveScene,
  sceneStripChanged,
  toUndoScene,
  type UndoScene,
} from "@/lib/scene-strip";
import { STYLE_META, isStyleId } from "@/video/visual-style";

/**
 * Change a finished video without opening the editor (roadmap U4): fix a word,
 * move or delete a scene, pick another look, drop the music, undo, then make the
 * video again. Nothing is made until "Update video" is pressed, so edits are free.
 */
export function ChangeVideo({
  jobId,
  scriptId,
}: {
  jobId: string;
  scriptId: string;
}) {
  const router = useRouter();
  const script = useScript(scriptId);
  const update = useUpdateScene(scriptId);
  const remove = useDeleteScene(scriptId);
  const reorder = useReorderScenes(scriptId);
  const undo = useUndoScript(scriptId);
  const setStyle = useSetScriptVisualStyle(scriptId);
  const setMusic = useSetScriptMusic(scriptId);
  /** The scenes as they were when this page opened; Undo puts them back. */
  const [snapshot, setSnapshot] = React.useState<UndoScene[] | null>(null);
  const scenes = React.useMemo(
    () => [...(script.data?.scenes ?? [])].sort((a, b) => a.order - b.order),
    [script.data?.scenes],
  );
  if (snapshot === null && scenes.length > 0)
    setSnapshot(scenes.map(toUndoScene));
  const [styleChanged, setStyleChanged] = React.useState(false);

  const make = useMutation({
    mutationFn: () =>
      apiPost<{ job: { id: string } }>(
        `/api/production-jobs/${jobId}/produce-current`,
        {},
      ),
    onSuccess: ({ job }) => {
      toast.success("Making the updated video");
      router.push(`/results/${job.id}`);
    },
    onError: (error) =>
      toast.error("Could not start the update", { description: error.message }),
  });

  if (script.isLoading) return null;
  if (!script.data || scenes.length === 0) return null;

  const changed =
    styleChanged || (snapshot ? sceneStripChanged(snapshot, scenes) : false);
  const busy =
    update.isPending || remove.isPending || reorder.isPending || undo.isPending;
  const onError = (error: Error) =>
    toast.error("That change did not save", { description: error.message });

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
              value={script.data.styleId}
              onChange={(event) => {
                if (!isStyleId(event.target.value)) return;
                setStyleChanged(true);
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
          {script.data.musicUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStyleChanged(true);
                setMusic.mutate({ musicUrl: null }, { onError });
              }}
            >
              Remove music
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={!changed || busy}
            onClick={() => {
              if (!snapshot) return;
              undo.mutate(snapshot, {
                onSuccess: () => toast.success("Back to how it was"),
                onError,
              });
            }}
          >
            <Undo2 className="size-4" aria-hidden /> Undo changes
          </Button>
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
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {scenes.map((scene, index) => (
          <li key={scene.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                Scene {index + 1} · {scene.templateId}
              </span>
              <span className="flex gap-1">
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
              onBlur={(event) => {
                const value = event.target.value.trim();
                if (value !== (scene.spokenText ?? ""))
                  update.mutate(
                    { id: scene.id, spokenText: value || null },
                    { onError },
                  );
              }}
            />
          </li>
        ))}
      </ol>
      <p className="text-muted-foreground text-xs">
        Changes are saved as you go. The video is made again when you press
        Update video.
      </p>
    </section>
  );
}
