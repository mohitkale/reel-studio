"use client";
import { SpeechPresets } from "./speech-presets";
import { applyPronunciations } from "@/lib/pronunciation";
import type { StudioPreset } from "@/lib/studio-preset";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useScript, useUpdateScene, useAddScene } from "@/hooks/script";
import { VoiceoverPanel } from "@/components/editor/voiceover-panel";
import { PageHeader } from "@/components/shell/page-header";
import { QueryError } from "@/components/ui/query-error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EditHistory } from "@/components/editor/edit-history";
import { AudioWorkbench } from "./audio-workbench";

function Paragraph({
  text,
  save,
}: {
  text: string;
  save(value: string): Promise<unknown>;
}) {
  const [draft, setDraft] = useState(text),
    [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      <Textarea
        aria-label="Paragraph script"
        value={draft}
        maxLength={4000}
        onChange={(e) => setDraft(e.target.value)}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={busy || draft === text || !draft.trim()}
        onClick={async () => {
          setBusy(true);
          try {
            await save(draft);
            toast.success("Paragraph saved");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Save failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Saving…" : "Save paragraph"}
      </Button>
    </div>
  );
}
export function VoiceoverWorkspace({ scriptId }: { scriptId: string }) {
  const query = useScript(scriptId),
    edit = useUpdateScene(scriptId),
    add = useAddScene(scriptId);
  const [rules, setRules] = useState<StudioPreset["pronunciations"]>([]);
  const [selectedScene, setSelectedScene] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null | undefined>(
      undefined,
    ),
    [compare, setCompare] = useState<string>("");
  const script = query.data;
  if (!script)
    return query.isError ? (
      <QueryError
        title="Could not load voiceover"
        error={query.error}
        retry={query.refetch}
      />
    ) : (
      <Skeleton className="h-80" />
    );
  const take =
    selected === undefined
      ? script.takes[0]
      : script.takes.find((t) => t.id === selected);
  const other = script.takes.find((t) => t.id === compare);
  return (
    <div className="space-y-6">
      <PageHeader
        title={script.name}
        description="Edit paragraphs and audition takes. Switch to the video editor to add visuals."
        actions={
          <Button variant="outline" asChild>
            <Link href={`/editor/${scriptId}`}>Add visuals</Link>
          </Button>
        }
      />
      {query.isError && (
        <QueryError
          title="Refresh failed; showing saved content"
          error={query.error}
          retry={query.refetch}
        />
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <section className="space-y-4">
          <EditHistory scriptId={scriptId} />
          <h2 className="font-semibold">Script</h2>
          <SpeechPresets
            pronunciations={rules}
            onApply={(preset) => {
              setRules(preset.pronunciations);
              toast.info(
                "Review pronunciation changes below before applying them.",
              );
            }}
          />
          {rules.length > 0 && (
            <p className="text-muted-foreground text-xs">
              {rules.length} pronunciation rules loaded. Changes below affect
              spoken text only and can be undone.
            </p>
          )}
          {script.scenes.map((scene, i) => (
            <article key={scene.id} className="space-y-2 rounded-xl border p-4">
              <h3 className="text-sm font-medium">Paragraph {i + 1}</h3>
              <Paragraph
                key={`${scene.id}:${scene.spokenText ?? scene.text}`}
                text={scene.spokenText ?? scene.text}
                save={(text) =>
                  edit.mutateAsync({ id: scene.id, spokenText: text })
                }
              />
              {rules.length > 0 &&
                applyPronunciations(scene.spokenText ?? scene.text, rules) !==
                  (scene.spokenText ?? scene.text) && (
                  <details className="text-sm">
                    <summary className="cursor-pointer">
                      Preview pronunciation changes
                    </summary>
                    <p className="my-2 whitespace-pre-wrap">
                      {applyPronunciations(
                        scene.spokenText ?? scene.text,
                        rules,
                      )}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={edit.isPending}
                      onClick={() =>
                        edit.mutate(
                          {
                            id: scene.id,
                            spokenText: applyPronunciations(
                              scene.spokenText ?? scene.text,
                              rules,
                            ),
                          },
                          { onError: (error) => toast.error(error.message) },
                        )
                      }
                    >
                      Apply to this paragraph
                    </Button>
                  </details>
                )}
            </article>
          ))}
          <Button
            disabled={add.isPending}
            onClick={() =>
              add.mutate("New paragraph", {
                onError: (error) => toast.error(error.message),
              })
            }
          >
            Add paragraph
          </Button>
        </section>
        <section className="min-w-0 space-y-4">
          <VoiceoverPanel
            scriptId={scriptId}
            scenes={script.scenes}
            takes={script.takes}
            voiceClips={script.voiceClips}
            voiceMode={script.voiceMode}
            selectedTakeId={take?.id ?? null}
            selectedSceneId={selectedScene}
            onSelectTake={setSelected}
            onClearTake={() => setSelected(null)}
            onSelectScene={setSelectedScene}
            hasScenes={script.scenes.length > 0}
          />
          {take && (
            <AudioWorkbench
              key={take.id}
              id={take.id}
              url={take.audioUrl}
              title={script.name}
              segments={take.timeline.map((beat) => ({
                id: beat.sceneId,
                text: beat.text,
                start: beat.startFrame / take.fps,
                end: (beat.startFrame + beat.durationFrames) / take.fps,
                speaker: "Narrator",
              }))}
            />
          )}
          {script.takes.length > 1 && (
            <section className="space-y-2 rounded-xl border p-4">
              <label className="grid gap-2 text-sm">
                Compare another take
                <select
                  className="bg-background w-full rounded-md border p-2"
                  value={compare}
                  onChange={(e) => setCompare(e.target.value)}
                >
                  <option value="">Choose take B</option>
                  {script.takes
                    .filter((t) => t.id !== take?.id)
                    .map((t, i) => (
                      <option value={t.id} key={t.id}>
                        {t.label ?? `Take ${i + 1}`} · {t.voiceId}
                      </option>
                    ))}
                </select>
              </label>
              {other && (
                <audio
                  controls
                  src={other.audioUrl}
                  className="w-full"
                  aria-label="Comparison take B"
                />
              )}
            </section>
          )}
        </section>
      </div>
    </div>
  );
}
