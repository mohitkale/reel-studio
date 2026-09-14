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

import type {
  PodcastDTO,
  PodcastLengthDTO,
  PodcastTakeVoiceDTO,
} from "@/lib/dto";
import type { AIProviderId } from "@/providers/ai/types";
import {
  PODCAST_PRESETS,
  type PodcastPresetId,
} from "@/library/podcast-presets";
import {
  useDeletePodcastTake,
  useDeletePodcastTurn,
  useGeneratePodcastScript,
  useGeneratePodcastTake,
  useInsertPodcastTurn,
  usePreparePodcastExport,
  useReplaceCharacters,
  useUpdateCharacterVoices,
  useUpdatePodcast,
  useUpdatePodcastTurn,
  type PodcastGenerationProgress,
} from "@/hooks/podcasts";
import { useAIProviders, useAIModels } from "@/hooks/ai";
import {
  downloadWavAtSpeed,
  PLAYBACK_SPEED_DEFAULT,
  PLAYBACK_SPEED_MAX,
  PLAYBACK_SPEED_MIN,
  PLAYBACK_SPEED_STEP,
} from "@/lib/client-audio-speed";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shell/page-header";
import { PodcastJsonDialog } from "./podcast-json-dialog";
import { PodcastGenerateProgress } from "./podcast-generate-progress";
import { CompactTurnRow } from "./compact-turn-row";
import { AddDialogueComposer } from "./add-dialogue-composer";
import { PodcastAudiogramControls } from "./podcast-audiogram-controls";
import { PodcastFinishingControls } from "./podcast-finishing-controls";
import {
  PodcastCharacterEditor,
  charactersToDrafts,
} from "./podcast-character-editor";

const fieldClass =
  "rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm";

function formatDuration(totalFrames: number, fps: number): string {
  const sec = Math.round(totalFrames / Math.max(fps, 1));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatSpeedLabel(speed: number): string {
  const rounded = Math.round(speed * 100) / 100;
  return `${rounded.toFixed(2).replace(/\.?0+$/, "") || "1"}×`;
}

function SpeedSlider({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (speed: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex max-w-[14rem] min-w-[9.5rem] flex-1 items-center gap-2">
      <Label className="text-muted-foreground shrink-0 text-[11px]">
        Speed
      </Label>
      <input
        type="range"
        min={PLAYBACK_SPEED_MIN}
        max={PLAYBACK_SPEED_MAX}
        step={PLAYBACK_SPEED_STEP}
        value={value}
        disabled={disabled}
        aria-label="Playback speed"
        className="accent-primary h-1.5 w-full min-w-0 disabled:opacity-50"
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="text-muted-foreground w-9 shrink-0 text-right text-xs tabular-nums">
        {formatSpeedLabel(value)}
      </span>
    </div>
  );
}

function VoicesUsedTooltip({
  voices,
  children,
}: {
  voices: PodcastTakeVoiceDTO[];
  children: React.ReactElement;
}) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        className="max-w-sm space-y-1.5 text-left font-normal"
      >
        <p className="text-[11px] font-semibold tracking-wide uppercase opacity-80">
          Voices used in this take
        </p>
        {voices.length === 0 ? (
          <p className="text-xs opacity-90">
            No voice snapshot (older take). Regenerate to record cast voices.
          </p>
        ) : (
          <ul className="space-y-1">
            {voices.map((v) => (
              <li key={v.key} className="text-xs leading-snug">
                <span className="font-medium">{v.name}</span>
                <span className="opacity-70"> ({v.key})</span>
                <br />
                <span className="opacity-85">
                  {v.providerId} · {v.voiceId}
                  {v.modelId ? ` · ${v.modelId}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function PodcastTakePlayer({ src, speed }: { src: string; speed: number }) {
  const ref = React.useRef<HTMLAudioElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.preload = "metadata";
    el.load();
  }, [src]);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.playbackRate = speed;
  }, [speed, src]);
  return (
    <audio
      ref={ref}
      className="h-9 w-full"
      controls
      src={src}
      preload="metadata"
    />
  );
}

export function PodcastWorkspace({ podcast }: { podcast: PodcastDTO }) {
  const formKey = [
    podcast.id,
    podcast.characters.map((c) => `${c.id}:${c.key}:${c.voiceId}`).join("|"),
    podcast.turns.map((t) => t.id).join(","),
    podcast.title,
    podcast.length,
    podcast.presetId,
    podcast.introMusicAssetId,
    podcast.outroMusicAssetId,
    podcast.pronunciations
      .map((rule) => `${rule.find}:${rule.replaceWith}:${rule.caseSensitive}`)
      .join("|"),
    podcast.turns
      .map((turn) => `${turn.id}:${turn.pauseAfterSeconds ?? "auto"}`)
      .join("|"),
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
  const insertTurn = useInsertPodcastTurn(podcast.id);
  const deleteTurn = useDeletePodcastTurn(podcast.id);
  const prepareExport = usePreparePodcastExport();

  const { data: aiProviders } = useAIProviders();
  const configuredAi = (aiProviders ?? []).filter((p) => p.configured);
  const [aiProviderId, setAiProviderId] = React.useState<AIProviderId | "">(
    () => configuredAi[0]?.id ?? "",
  );
  const effectiveAi = (aiProviderId || configuredAi[0]?.id || "") as
    AIProviderId | "";
  const { data: aiModels } = useAIModels(effectiveAi || undefined);
  const [aiModelId, setAiModelId] = React.useState("");
  const [brief, setBrief] = React.useState("");
  const [jsonOpen, setJsonOpen] = React.useState(false);
  const [progress, setProgress] =
    React.useState<PodcastGenerationProgress | null>(null);
  const [generateStartedAt, setGenerateStartedAt] = React.useState<
    number | null
  >(null);
  const [tab, setTab] = React.useState(() =>
    podcast.turns.length > 0 ? "script" : "setup",
  );
  const [takeSpeeds, setTakeSpeeds] = React.useState<Record<string, number>>(
    {},
  );
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [insertAfterId, setInsertAfterId] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState(podcast.title);
  const [description, setDescription] = React.useState(podcast.description);
  const [length, setLength] = React.useState<PodcastLengthDTO>(podcast.length);
  const [presetId, setPresetId] = React.useState<PodcastPresetId>(
    podcast.presetId,
  );
  const [drafts, setDrafts] = React.useState(() =>
    charactersToDrafts(podcast.characters),
  );

  function speedFor(takeId: string): number {
    return takeSpeeds[takeId] ?? PLAYBACK_SPEED_DEFAULT;
  }

  function setSpeedFor(takeId: string, speed: number) {
    setTakeSpeeds((prev) => ({ ...prev, [takeId]: speed }));
  }

  function saveMeta() {
    updateMeta.mutate(
      {
        title: title.trim() || "Untitled podcast",
        description,
        length,
        presetId,
      },
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
          onSuccess: () => {
            toast.success("Characters updated (script cleared — regenerate)");
            setTab("script");
          },
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
    if (castChanged) {
      toast.error("Save the updated cast before generating a script");
      setTab("setup");
      return;
    }
    if (presetId === "solo-narration" && drafts.length !== 1) {
      toast.error("Solo narration needs one character", {
        description: "Remove the extra speakers and save the cast first.",
      });
      setTab("setup");
      return;
    }
    if (presetId !== "solo-narration" && drafts.length < 2) {
      toast.error("This format needs at least two characters");
      setTab("setup");
      return;
    }
    generateScript.mutate(
      {
        providerId: effectiveAi,
        modelId: aiModelId || undefined,
        brief: brief.trim(),
        length,
        presetId,
        updateMeta: true,
      },
      {
        onSuccess: () => {
          toast.success("Humanised script generated");
          setTab("script");
        },
        onError: (e) =>
          toast.error("AI script failed", {
            description: (e as Error).message,
          }),
      },
    );
  }

  async function runAudio(regenerateTurnIds?: string[]) {
    const missing = drafts.filter((d) => !d.providerId || !d.voiceId);
    if (missing.length) {
      toast.error(`Pick a voice for: ${missing.map((m) => m.name).join(", ")}`);
      setTab("setup");
      return;
    }
    if (podcast.turns.length === 0) {
      toast.error("Generate or import a script first");
      setTab("script");
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
      setTab("audio");
      const started = Date.now();
      setGenerateStartedAt(started);
      setProgress({
        status: "queued",
        scene: 0,
        sceneCount: podcast.turns.length,
      });
      await generateTake.mutateAsync({
        onProgress: setProgress,
        regenerateTurnIds,
      });
      setProgress(null);
      setGenerateStartedAt(null);
      toast.success(
        regenerateTurnIds?.length
          ? "Selected turn regenerated; unchanged turns reused"
          : "Podcast audio ready",
      );
    } catch (e) {
      setProgress(null);
      setGenerateStartedAt(null);
      toast.error("Audio generation failed", {
        description: (e as Error).message,
      });
    }
  }

  async function handleDownload(
    takeId: string,
    audioUrl: string,
    speed: number,
  ) {
    setDownloadingId(takeId);
    try {
      const base =
        podcast.title.replace(/[^\w\-]+/g, "_").replace(/^_|_$/g, "") ||
        "podcast";
      await downloadWavAtSpeed({
        url: audioUrl,
        filename: base,
        speed,
      });
      toast.success(
        Math.abs(speed - 1) < 0.001
          ? "Download started"
          : `Download started at ${formatSpeedLabel(speed)}`,
      );
    } catch (e) {
      toast.error("Download failed", {
        description: (e as Error).message,
      });
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleMp3Download(takeId: string) {
    setDownloadingId(takeId);
    try {
      const prepared = await prepareExport.mutateAsync({
        takeId,
        format: "mp3",
      });
      const link = document.createElement("a");
      link.href = prepared.url;
      link.download = `${podcast.title.replace(/[^\w\-]+/g, "_") || "podcast"}.mp3`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("MP3 download started");
    } catch (error) {
      toast.error("MP3 export failed", {
        description: (error as Error).message,
      });
    } finally {
      setDownloadingId(null);
    }
  }

  const busy =
    generateTake.isPending ||
    generateScript.isPending ||
    replaceChars.isPending ||
    updateVoices.isPending;

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] w-full flex-col gap-3 overflow-hidden px-1 pb-2 sm:px-2">
      <PageHeader
        title={podcast.title}
        description={`${podcast.characters.length} voices · ${podcast.turns.length} turns · ${podcast.takes.length} takes`}
        actions={
          <div className="flex items-center gap-2">
            <HintTooltip label="Synthesize all turns, then stitch in order">
              <Button
                type="button"
                size="sm"
                onClick={() => void runAudio()}
                disabled={busy || podcast.turns.length === 0}
              >
                {generateTake.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Mic className="size-4" />
                )}
                Generate
              </Button>
            </HintTooltip>
            <Button asChild variant="ghost" size="sm">
              <Link href="/podcasts">
                <ArrowLeft className="size-4" />
                All podcasts
              </Link>
            </Button>
          </div>
        }
      />

      {progress && generateStartedAt ? (
        <PodcastGenerateProgress
          progress={progress}
          startedAt={generateStartedAt}
        />
      ) : null}

      <Tabs
        value={tab}
        onValueChange={setTab}
        className="flex min-h-0 flex-1 flex-col gap-3"
      >
        <TabsList className="w-full shrink-0 justify-start sm:w-auto">
          <TabsTrigger value="setup">
            Setup
            <Badge variant="secondary" className="ml-1.5 text-[10px]">
              {drafts.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="script">
            Script
            <Badge variant="secondary" className="ml-1.5 text-[10px]">
              {podcast.turns.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="audio">
            Audio
            <Badge variant="secondary" className="ml-1.5 text-[10px]">
              {podcast.takes.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="setup"
          className="mt-0 min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] xl:items-start">
            <section className="border-border bg-card grid gap-3 rounded-xl border p-4 shadow-sm">
              <div>
                <h2 className="text-sm font-semibold">Episode details</h2>
                <p className="text-muted-foreground text-xs">
                  Title, description, and target length
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pod-title">Title</Label>
                <Input
                  id="pod-title"
                  className="bg-background"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pod-desc">Description</Label>
                <textarea
                  id="pod-desc"
                  className={`min-h-[72px] w-full ${fieldClass}`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Production format</Label>
                <Combobox
                  value={presetId}
                  onChange={(value) => setPresetId(value as PodcastPresetId)}
                  options={Object.values(PODCAST_PRESETS).map((preset) => ({
                    value: preset.id,
                    label: preset.label,
                  }))}
                  className="bg-background"
                />
                <p className="text-muted-foreground text-xs">
                  {PODCAST_PRESETS[presetId].description}
                </p>
                <p className="text-muted-foreground text-[11px]">
                  Solo uses one character; discussions and interviews use two or
                  more. Edit the cast beside this card when changing formats.
                </p>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="grid gap-1.5">
                  <Label>Length</Label>
                  <div className="border-border bg-muted/50 inline-flex rounded-lg border p-0.5">
                    {(
                      [
                        { id: "short", label: "Short" },
                        { id: "long", label: "Long" },
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
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={saveMeta}
                  disabled={updateMeta.isPending}
                >
                  Save details
                </Button>
              </div>
            </section>

            <section className="border-border bg-card grid gap-3 rounded-xl border p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">Characters & voices</h2>
                  <p className="text-muted-foreground text-xs">
                    Cast, persona notes, and TTS voice for each speaker
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => saveCharacters(castChanged)}
                  disabled={busy}
                >
                  {castChanged ? "Save cast" : "Save voices"}
                </Button>
              </div>
              {castChanged ? (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-300">
                  Changing the cast clears the current script.
                </p>
              ) : null}
              <PodcastCharacterEditor drafts={drafts} onChange={setDrafts} />
            </section>
          </div>
        </TabsContent>

        <TabsContent
          value="script"
          className="mt-0 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden data-[state=inactive]:hidden"
        >
          <section className="border-border bg-card shrink-0 rounded-xl border p-3 shadow-sm sm:p-4">
            <div className="mb-2">
              <h2 className="text-sm font-semibold">Generate script</h2>
              <p className="text-muted-foreground text-xs">
                AI from a brief, or paste structured JSON
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="grid gap-1">
                <Label className="text-xs">AI provider</Label>
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
                  className="bg-background"
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Model</Label>
                <Combobox
                  value={aiModelId}
                  onChange={setAiModelId}
                  options={(aiModels ?? []).map((m) => ({
                    value: m.id,
                    label: m.label,
                  }))}
                  placeholder="Default model"
                  disabled={!effectiveAi}
                  className="bg-background"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  onClick={runAi}
                  disabled={generateScript.isPending || !effectiveAi}
                >
                  {generateScript.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Generate
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setJsonOpen(true)}
                >
                  <Braces className="size-4" />
                  JSON
                </Button>
              </div>
            </div>
            <textarea
              className={`mt-2 min-h-[56px] w-full ${fieldClass}`}
              placeholder="Topic / brief for AI…"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
            />
          </section>

          <section className="border-border bg-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-sm">
            <div className="border-border flex shrink-0 items-center justify-between border-b px-3 py-2">
              <div>
                <h2 className="text-sm font-semibold">Dialogue</h2>
                <p className="text-muted-foreground text-xs">
                  Click a line to edit · hover for full text · + between lines
                  to insert
                </p>
              </div>
              <Badge variant="secondary">{podcast.turns.length} turns</Badge>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {podcast.turns.length === 0 ? (
                <div className="grid gap-3 p-2">
                  <p className="text-muted-foreground text-sm">
                    No turns yet. Generate with AI, paste JSON, or add the first
                    line below.
                  </p>
                  <AddDialogueComposer
                    characters={podcast.characters}
                    disabled={busy}
                    pending={insertTurn.isPending}
                    onAdd={async (vars) => {
                      try {
                        await insertTurn.mutateAsync(vars);
                        toast.success("Dialogue added");
                      } catch (e) {
                        toast.error((e as Error).message);
                        throw e;
                      }
                    }}
                  />
                </div>
              ) : (
                <ul className="flex min-w-0 flex-col gap-1">
                  {podcast.turns.map((t, i) => (
                    <React.Fragment key={t.id}>
                      <CompactTurnRow
                        index={i}
                        characterName={t.characterName}
                        characterKey={t.characterKey}
                        text={t.text}
                        pauseAfterSeconds={t.pauseAfterSeconds}
                        disabled={busy || insertTurn.isPending}
                        onSave={async (text) => {
                          try {
                            await updateTurn.mutateAsync({
                              turnId: t.id,
                              text,
                            });
                            toast.success("Turn updated");
                          } catch (e) {
                            toast.error((e as Error).message);
                            throw e;
                          }
                        }}
                        onDelete={() =>
                          deleteTurn.mutate(t.id, {
                            onSuccess: () => toast.info("Turn removed"),
                          })
                        }
                        onPauseChange={(pauseAfterSeconds) =>
                          updateTurn.mutate(
                            { turnId: t.id, pauseAfterSeconds },
                            {
                              onSuccess: () =>
                                toast.success("Turn pause saved"),
                              onError: (error) =>
                                toast.error("Could not save pause", {
                                  description: (error as Error).message,
                                }),
                            },
                          )
                        }
                        onRegenerate={() => void runAudio([t.id])}
                      />
                      {insertAfterId === t.id ? (
                        <li className="list-none space-y-1.5 py-1">
                          <AddDialogueComposer
                            characters={podcast.characters}
                            afterTurnId={t.id}
                            compact
                            disabled={busy}
                            pending={insertTurn.isPending}
                            onAdd={async (vars) => {
                              try {
                                await insertTurn.mutateAsync(vars);
                                toast.success("Dialogue inserted");
                                setInsertAfterId(null);
                              } catch (e) {
                                toast.error((e as Error).message);
                                throw e;
                              }
                            }}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => setInsertAfterId(null)}
                          >
                            Cancel insert
                          </Button>
                        </li>
                      ) : (
                        <li className="group/insert relative h-2 list-none">
                          <button
                            type="button"
                            disabled={busy || insertTurn.isPending}
                            className="hover:border-border hover:bg-background hover:text-muted-foreground group-hover/insert:border-border group-hover/insert:bg-background group-hover/insert:text-muted-foreground absolute inset-x-10 top-1/2 z-10 flex -translate-y-1/2 items-center justify-center gap-1 rounded-full border border-dashed border-transparent py-0.5 text-[10px] text-transparent transition-colors"
                            onClick={() => setInsertAfterId(t.id)}
                          >
                            + Insert line here
                          </button>
                        </li>
                      )}
                    </React.Fragment>
                  ))}
                  <li className="mt-2 list-none">
                    <AddDialogueComposer
                      characters={podcast.characters}
                      disabled={busy}
                      pending={insertTurn.isPending}
                      onAdd={async (vars) => {
                        try {
                          await insertTurn.mutateAsync(vars);
                          toast.success("Dialogue added");
                        } catch (e) {
                          toast.error((e as Error).message);
                          throw e;
                        }
                      }}
                    />
                  </li>
                </ul>
              )}
            </div>
          </section>
        </TabsContent>

        <TabsContent
          value="audio"
          className="mt-0 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto data-[state=inactive]:hidden"
        >
          <PodcastFinishingControls podcast={podcast} />
          <section className="border-border bg-card flex flex-wrap items-center gap-3 rounded-xl border p-3 shadow-sm">
            <Button
              type="button"
              onClick={() => void runAudio()}
              disabled={busy || podcast.turns.length === 0}
            >
              {generateTake.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mic className="size-4" />
              )}
              Generate podcast audio
            </Button>
            {podcast.turns.length > 0 ? (
              <span className="text-muted-foreground text-xs">
                Reuses unchanged turns, then stitches {podcast.turns.length} in
                order · set speed per take below
              </span>
            ) : null}
          </section>

          {podcast.takes.length === 0 ? (
            <p className="border-border bg-card/50 text-muted-foreground rounded-xl border border-dashed p-6 text-sm">
              No takes yet. Generate podcast audio to hear the full episode.
            </p>
          ) : (
            <ul className="grid gap-3">
              {podcast.takes.map((take) => {
                const speed = speedFor(take.id);
                return (
                  <li
                    key={take.id}
                    className="border-border bg-card grid gap-2 rounded-xl border p-3 shadow-sm sm:p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <VoicesUsedTooltip voices={take.voices ?? []}>
                        <button
                          type="button"
                          className="hover:bg-muted/40 flex min-w-0 flex-1 items-center gap-2 rounded-md text-left"
                        >
                          <Volume2 className="text-muted-foreground size-4 shrink-0" />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {take.label || "Take"}
                          </span>
                          {(take.voices?.length ?? 0) > 0 ? (
                            <Badge
                              variant="outline"
                              className="hidden shrink-0 text-[10px] sm:inline-flex"
                            >
                              {take.voices.length} voices
                            </Badge>
                          ) : null}
                        </button>
                      </VoicesUsedTooltip>
                      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                        <SpeedSlider
                          value={speed}
                          onChange={(s) => setSpeedFor(take.id, s)}
                          disabled={downloadingId === take.id}
                        />
                        <Badge
                          variant="secondary"
                          className="shrink-0 tabular-nums"
                        >
                          {formatDuration(take.totalFrames, take.fps)}
                        </Badge>
                        <HintTooltip
                          label={
                            Math.abs(speed - 1) < 0.001
                              ? "Download WAV"
                              : `Download WAV at ${formatSpeedLabel(speed)}`
                          }
                        >
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="text-muted-foreground hover:text-foreground size-8 bg-transparent hover:bg-transparent"
                            aria-label="Download WAV"
                            disabled={downloadingId === take.id}
                            onClick={() =>
                              void handleDownload(take.id, take.audioUrl, speed)
                            }
                          >
                            {downloadingId === take.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Download className="size-4" />
                            )}
                          </Button>
                        </HintTooltip>
                        <HintTooltip label="Download production MP3">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={downloadingId === take.id}
                            className="text-muted-foreground hover:text-foreground h-8 bg-transparent px-2 text-xs hover:bg-transparent"
                            onClick={() => void handleMp3Download(take.id)}
                          >
                            MP3
                          </Button>
                        </HintTooltip>
                        <HintTooltip label="Delete this take">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive size-8 bg-transparent hover:bg-transparent"
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
                    <PodcastTakePlayer src={take.audioUrl} speed={speed} />
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Button asChild type="button" size="sm" variant="outline">
                        <a
                          href={`/api/podcast-takes/${take.id}/transcript?format=transcript`}
                          download
                        >
                          Transcript
                        </a>
                      </Button>
                      <Button asChild type="button" size="sm" variant="outline">
                        <a
                          href={`/api/podcast-takes/${take.id}/transcript?format=chapters`}
                          download
                        >
                          Chapters JSON
                        </a>
                      </Button>
                      {take.chapters.map((chapter) => (
                        <Badge key={chapter.id} variant="secondary">
                          {chapter.title}
                        </Badge>
                      ))}
                    </div>
                    <PodcastAudiogramControls take={take} />
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>

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
