"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Braces,
  Download,
  Loader2,
  Mic,
  Sparkles,
  Trash2,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";

import type { PodcastDTO, PodcastLengthDTO } from "@/lib/dto";
import type { AIProviderId } from "@/providers/ai/types";
import {
  useDeletePodcastTake,
  useDeletePodcastTurn,
  useGeneratePodcastScript,
  useGeneratePodcastTake,
  useReplaceCharacters,
  useUpdateCharacterVoices,
  useUpdatePodcast,
  useUpdatePodcastTurn,
  type PodcastGenerationProgress,
} from "@/hooks/podcasts";
import { useAIProviders, useAIModels } from "@/hooks/ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { PageHeader } from "@/components/shell/page-header";
import { PodcastJsonDialog } from "./podcast-json-dialog";
import { PodcastGenerateProgress } from "./podcast-generate-progress";
import {
  PodcastCharacterEditor,
  charactersToDrafts,
} from "./podcast-character-editor";

function formatDuration(totalFrames: number, fps: number): string {
  const sec = Math.round(totalFrames / Math.max(fps, 1));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** Loads metadata immediately so the duration shows without clicking play. */
function PodcastTakePlayer({ src }: { src: string }) {
  const ref = React.useRef<HTMLAudioElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.preload = "metadata";
    el.load();
  }, [src]);
  return (
    <audio
      ref={ref}
      className="h-10 w-full"
      controls
      src={src}
      preload="metadata"
    />
  );
}

export function PodcastWorkspace({ podcast }: { podcast: PodcastDTO }) {
  // Remount when cast or turn set changes so local form state stays in sync.
  const formKey = [
    podcast.id,
    podcast.characters.map((c) => `${c.id}:${c.key}:${c.voiceId}`).join("|"),
    podcast.turns.map((t) => t.id).join(","),
    podcast.title,
    podcast.length,
  ].join("::");
  return <PodcastWorkspaceForm key={formKey} podcast={podcast} />;
}

function PodcastWorkspaceForm({ podcast }: { podcast: PodcastDTO }) {
  const updateMeta = useUpdatePodcast(podcast.id);
  const replaceChars = useReplaceCharacters(podcast.id);
  const updateVoices = useUpdateCharacterVoices(podcast.id);
  const generateScript = useGeneratePodcastScript(podcast.id);
  const generateTake = useGeneratePodcastTake(podcast.id);
  const deleteTake = useDeletePodcastTake(podcast.id);
  const updateTurn = useUpdatePodcastTurn(podcast.id);
  const deleteTurn = useDeletePodcastTurn(podcast.id);

  const { data: aiProviders } = useAIProviders();
  const configuredAi = (aiProviders ?? []).filter((p) => p.configured);
  const [aiProviderId, setAiProviderId] = React.useState<AIProviderId | "">(
    () => configuredAi[0]?.id ?? "",
  );
  const effectiveAi =
    (aiProviderId || configuredAi[0]?.id || "") as AIProviderId | "";
  const { data: aiModels } = useAIModels(effectiveAi || undefined);
  const [aiModelId, setAiModelId] = React.useState("");
  const [brief, setBrief] = React.useState("");
  const [jsonOpen, setJsonOpen] = React.useState(false);
  const [progress, setProgress] =
    React.useState<PodcastGenerationProgress | null>(null);
  const [generateStartedAt, setGenerateStartedAt] = React.useState<
    number | null
  >(null);

  const [title, setTitle] = React.useState(podcast.title);
  const [description, setDescription] = React.useState(podcast.description);
  const [length, setLength] = React.useState<PodcastLengthDTO>(podcast.length);
  const [drafts, setDrafts] = React.useState(() =>
    charactersToDrafts(podcast.characters),
  );

  function saveMeta() {
    updateMeta.mutate(
      { title: title.trim() || "Untitled podcast", description, length },
      {
        onSuccess: () => toast.success("Podcast saved"),
        onError: (e) =>
          toast.error("Could not save", { description: (e as Error).message }),
      },
    );
  }

  function saveCharacters(replace: boolean) {
    if (replace) {
      replaceChars.mutate(
        drafts.map((d) => ({
          id: d.id,
          key: d.key,
          name: d.name,
          gender: d.gender,
          definition: d.definition,
          providerId: d.providerId,
          voiceId: d.voiceId,
          modelId: d.modelId,
        })),
        {
          onSuccess: () =>
            toast.success("Characters updated (script cleared — regenerate)"),
          onError: (e) =>
            toast.error("Could not update characters", {
              description: (e as Error).message,
            }),
        },
      );
      return;
    }
    const updates = drafts
      .filter((d) => d.id)
          .map((d) => ({
            id: d.id!,
            name: d.name,
            gender: d.gender,
            definition: d.definition,
            providerId: d.providerId,
            voiceId: d.voiceId,
            modelId: d.modelId,
          }));
    updateVoices.mutate(updates, {
      onSuccess: () => toast.success("Voices saved"),
      onError: (e) =>
        toast.error("Could not save voices", {
          description: (e as Error).message,
        }),
    });
  }

  const castChanged =
    drafts.length !== podcast.characters.length ||
    drafts.some((d, i) => {
      const c = podcast.characters[i];
      return !c || d.key !== c.key || !d.id || d.id !== c.id;
    });

  function runAi() {
    if (!effectiveAi) {
      toast.error("Configure an AI provider in Settings");
      return;
    }
    if (brief.trim().length < 3) {
      toast.error("Add a short topic or brief first");
      return;
    }
    generateScript.mutate(
      {
        providerId: effectiveAi,
        modelId: aiModelId || undefined,
        brief: brief.trim(),
        length,
        updateMeta: true,
      },
      {
        onSuccess: () => toast.success("Humanised script generated"),
        onError: (e) =>
          toast.error("AI script failed", {
            description: (e as Error).message,
          }),
      },
    );
  }

  async function runAudio() {
    const missing = drafts.filter((d) => !d.providerId || !d.voiceId);
    if (missing.length) {
      toast.error(`Pick a voice for: ${missing.map((m) => m.name).join(", ")}`);
      return;
    }
    if (podcast.turns.length === 0) {
      toast.error("Generate or import a script first");
      return;
    }
    try {
      if (!castChanged) {
        const updates = drafts
          .filter((d) => d.id)
          .map((d) => ({
            id: d.id!,
            name: d.name,
            gender: d.gender,
            definition: d.definition,
            providerId: d.providerId,
            voiceId: d.voiceId,
            modelId: d.modelId,
          }));
        if (updates.length) await updateVoices.mutateAsync(updates);
      }
      const started = Date.now();
      setGenerateStartedAt(started);
      setProgress({ status: "queued", scene: 0, sceneCount: podcast.turns.length });
      await generateTake.mutateAsync({ onProgress: setProgress });
      setProgress(null);
      setGenerateStartedAt(null);
      toast.success("Podcast audio ready");
    } catch (e) {
      setProgress(null);
      setGenerateStartedAt(null);
      toast.error("Audio generation failed", {
        description: (e as Error).message,
      });
    }
  }

  const busy =
    generateTake.isPending ||
    generateScript.isPending ||
    replaceChars.isPending ||
    updateVoices.isPending;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 pb-16">
      <PageHeader
        title={podcast.title}
        description="Voice-only podcast · setup characters, write a humanised script, generate audio"
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/podcasts">
              <ArrowLeft className="size-4" />
              All podcasts
            </Link>
          </Button>
        }
      />

      {/* Setup */}
      <section className="grid gap-4 rounded-xl border p-4 sm:p-5">
        <div>
          <h2 className="text-base font-semibold">1. Setup</h2>
          <p className="text-sm text-muted-foreground">
            Title, length, and 2–4 characters with voices. Character keys feed
            the JSON / AI script.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="pod-title">Title</Label>
            <Input
              id="pod-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="pod-desc">Description</Label>
            <textarea
              id="pod-desc"
              className="min-h-[72px] rounded-md border bg-background px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Length</Label>
            <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
              {(
                [
                  { id: "short", label: "Short · 2–3 min" },
                  { id: "long", label: "Long · 5–10 min" },
                ] as const
              ).map((opt) => (
                <Button
                  key={opt.id}
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={
                    length === opt.id
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground"
                  }
                  onClick={() => setLength(opt.id)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-end justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={saveMeta}
              disabled={updateMeta.isPending}
            >
              Save details
            </Button>
          </div>
        </div>

        <PodcastCharacterEditor drafts={drafts} onChange={setDrafts} />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => saveCharacters(castChanged)}
            disabled={busy}
          >
            {castChanged ? "Save cast (clears script)" : "Save voices"}
          </Button>
          {castChanged ? (
            <p className="self-center text-xs text-amber-600 dark:text-amber-400">
              Changing who is in the cast clears the current script.
            </p>
          ) : null}
        </div>
      </section>

      {/* Script */}
      <section className="grid gap-4 rounded-xl border p-4 sm:p-5">
        <div>
          <h2 className="text-base font-semibold">2. Script</h2>
          <p className="text-sm text-muted-foreground">
            Generate a humanised dialogue with AI, or paste JSON from ChatGPT /
            Claude using your character keys.
          </p>
        </div>

        <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>AI provider</Label>
              <Combobox
                value={effectiveAi}
                onChange={(v) => {
                  setAiProviderId(v as AIProviderId);
                  setAiModelId("");
                }}
                options={configuredAi.map((p) => ({
                  value: p.id,
                  label: p.label,
                }))}
                placeholder="AI provider"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Model</Label>
              <Combobox
                value={aiModelId}
                onChange={setAiModelId}
                options={(aiModels ?? []).map((m) => ({
                  value: m.id,
                  label: m.label,
                }))}
                placeholder="Default model"
                disabled={!effectiveAi}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pod-brief">Topic / brief</Label>
            <textarea
              id="pod-brief"
              className="min-h-[88px] rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="What should they talk about? Audience, angle, tone…"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={runAi}
              disabled={generateScript.isPending || !effectiveAi}
            >
              {generateScript.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Generate script with AI
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setJsonOpen(true)}
            >
              <Braces className="size-4" />
              Paste JSON
            </Button>
          </div>
        </div>

        {podcast.turns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No turns yet. Generate with AI or import JSON.
          </p>
        ) : (
          <ul className="grid gap-2">
            {podcast.turns.map((t, i) => (
              <TurnRow
                key={`${t.id}:${t.text}`}
                index={i}
                characterName={t.characterName}
                characterKey={t.characterKey}
                text={t.text}
                disabled={busy}
                onSave={(text) =>
                  updateTurn.mutate(
                    { turnId: t.id, text },
                    {
                      onSuccess: () => toast.success("Turn updated"),
                      onError: (e) =>
                        toast.error((e as Error).message),
                    },
                  )
                }
                onDelete={() =>
                  deleteTurn.mutate(t.id, {
                    onSuccess: () => toast.info("Turn removed"),
                  })
                }
              />
            ))}
          </ul>
        )}
      </section>

      {/* Produce */}
      <section className="grid gap-4 rounded-xl border p-4 sm:p-5">
        <div>
          <h2 className="text-base font-semibold">3. Produce audio</h2>
          <p className="text-sm text-muted-foreground">
            One click synthesizes each turn with that character&apos;s voice,
            then stitches them in script order.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <HintTooltip label="Synthesize every script turn, then merge in order">
            <Button
              type="button"
              size="lg"
              onClick={runAudio}
              disabled={busy || podcast.turns.length === 0}
            >
              {generateTake.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mic className="size-4" />
              )}
              Generate podcast audio
            </Button>
          </HintTooltip>
          {podcast.turns.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {podcast.turns.length} turns · ~{Math.round(100 / podcast.turns.length)}%
              per chunk
            </span>
          ) : null}
        </div>

        {progress && generateStartedAt ? (
          <PodcastGenerateProgress
            progress={progress}
            startedAt={generateStartedAt}
          />
        ) : null}

        {podcast.takes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No takes yet.</p>
        ) : (
          <ul className="grid gap-3">
            {podcast.takes.map((take) => (
              <li key={take.id} className="grid gap-2 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Volume2 className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {take.label || "Take"}
                  </span>
                  <Badge variant="secondary" className="shrink-0">
                    {formatDuration(take.totalFrames, take.fps)}
                  </Badge>
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    <HintTooltip label="Download WAV">
                      <Button asChild size="icon" variant="secondary">
                        <a
                          href={take.audioUrl}
                          download={`${podcast.title.replace(/[^\w\-]+/g, "_") || "podcast"}.wav`}
                          aria-label="Download WAV"
                        >
                          <Download className="size-4" />
                        </a>
                      </Button>
                    </HintTooltip>
                    <HintTooltip label="Delete this take">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Delete take"
                        onClick={() =>
                          deleteTake.mutate(take.id, {
                            onSuccess: () => toast.info("Take deleted"),
                          })
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </HintTooltip>
                  </div>
                </div>
                <PodcastTakePlayer src={take.audioUrl} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <PodcastJsonDialog
        podcastId={podcast.id}
        characters={podcast.characters}
        length={length}
        open={jsonOpen}
        onOpenChange={setJsonOpen}
      />
    </div>
  );
}

function TurnRow({
  index,
  characterName,
  characterKey,
  text,
  disabled,
  onSave,
  onDelete,
}: {
  index: number;
  characterName: string;
  characterKey: string;
  text: string;
  disabled?: boolean;
  onSave: (text: string) => void;
  onDelete: () => void;
}) {
  const [value, setValue] = React.useState(text);
  const dirty = value !== text;

  return (
    <li className="grid gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{index + 1}</Badge>
          <span className="text-sm font-medium">{characterName}</span>
          <span className="text-xs text-muted-foreground">{characterKey}</span>
        </div>
        <HintTooltip label="Remove this turn">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={disabled}
            className="text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            aria-label="Delete turn"
          >
            <Trash2 className="size-4" />
          </Button>
        </HintTooltip>
      </div>
      <textarea
        className="min-h-[64px] rounded-md border bg-background px-3 py-2 text-sm"
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
      />
      {dirty ? (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setValue(text)}
          >
            Reset
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={disabled || !value.trim()}
            onClick={() => onSave(value.trim())}
          >
            Save turn
          </Button>
        </div>
      ) : null}
    </li>
  );
}
