"use client";

import * as React from "react";
import Link from "next/link";
import { Cpu, Loader2, Mic, Sparkles, Square, Trash2, Volume2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import type { VoiceTakeDTO } from "@/lib/dto";
import type { ProviderId } from "@/providers/voice/types";
import { voiceforgeEngineHelperText } from "@/providers/voice/voiceforge-engines";
import { useProviders, useModels, useVoices } from "@/hooks/voice";
import { VoiceCloneDialog } from "@/components/voice/voice-clone-dialog";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGenerateTake,
  useDeleteTake,
  type VoiceGenerationProgress,
} from "@/hooks/script";
import {
  useKokoroGenerate,
  useWebSpeechPreview,
  type KokoroGenerateProgress,
} from "@/hooks/client-tts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";

function formatTakeDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function kokoroProgressLabel(p: KokoroGenerateProgress | null): string {
  if (!p) return "";
  if (p.phase === "model")
    return p.modelProgress != null
      ? `Loading voice model… ${Math.round(p.modelProgress * 100)}%`
      : "Loading voice model…";
  if (p.phase === "synth")
    return `Synthesizing scene ${p.scene}/${p.sceneCount}…`;
  return "Uploading…";
}

/** Live progress label for server-side providers (Cartesia, ElevenLabs, Kokoro server). */
function serverProgressLabel(
  p: VoiceGenerationProgress | null,
  providerId?: ProviderId,
): string {
  if (!p) return "";
  if (p.status === "queued") return "Queued…";
  if (p.status === "stitching") return "Stitching audio…";
  if (p.status === "synthesizing") {
    const active =
      p.workingOn ??
      (p.sceneCount > 0 ? Math.min(p.scene + 1, p.sceneCount) : undefined);
    if (p.sceneCount > 0 && active) {
      const base = `Synthesizing scene ${active}/${p.sceneCount}…`;
      if (providerId === "voiceforge") {
        return `${base} VoiceForge on CPU often needs 1–10 min per scene (first call loads the model). Watch VoiceForge Docker CPU — if it is busy, it is working.`;
      }
      return base;
    }
    return "Synthesizing…";
  }
  return "";
}

export function VoiceoverPanel({
  scriptId,
  scenes,
  takes,
  selectedTakeId,
  onSelectTake,
  onClearTake,
  hasScenes,
}: {
  scriptId: string;
  scenes: { id: string; text: string }[];
  takes: VoiceTakeDTO[];
  selectedTakeId: string | null;
  onSelectTake: (id: string) => void;
  onClearTake?: () => void;
  hasScenes: boolean;
}) {
  const { data: providersData } = useProviders();
  const configured = (providersData?.providers ?? []).filter((p) => p.configured);

  const [providerId, setProviderId] = React.useState<ProviderId | undefined>();
  const [voiceId, setVoiceId] = React.useState("");
  const [modelId, setModelId] = React.useState("");

  const effectiveProvider =
    providerId ?? providersData?.config.defaultProviderId ?? configured[0]?.id;

  const selectedStatus = configured.find((p) => p.id === effectiveProvider);
  const isVoiceforge = effectiveProvider === "voiceforge";
  const isPreview = selectedStatus?.preview === true; // Web Speech
  const isKokoro = selectedStatus?.runtime === "client" && !isPreview;

  const { data: voices, isLoading: voicesLoading } = useVoices(effectiveProvider, "");
  const { data: models } = useModels(effectiveProvider);

  // Web Speech voices come from the browser, not the server.
  const webSpeech = useWebSpeechPreview();

  const modelOptions: ComboboxOption[] = (models ?? []).map((m) => ({
    value: m.id,
    label: m.label,
  }));

  const effectiveModel =
    modelId && models?.some((m) => m.id === modelId)
      ? modelId
      : (models?.[0]?.id ?? "");

  // VoiceForge binds an engine to each cloned voice at create time. The engine
  // dropdown filters which clones appear; synthesis still uses that voice's engine.
  const voicesForPicker = React.useMemo(() => {
    const all = voices ?? [];
    if (!isVoiceforge || !effectiveModel) return all;
    return all.filter((v) => v.tags?.includes(effectiveModel));
  }, [voices, isVoiceforge, effectiveModel]);

  const mine = voicesForPicker.filter(
    (v) => v.category === "cloned" || v.category === "professional",
  );
  const library = voicesForPicker.filter(
    (v) => v.category === "default" || v.category === "shared",
  );

  const serverVoiceOptions: ComboboxOption[] = [
    ...mine.map((v) => {
      const engine = v.tags?.[0];
      return {
        value: v.id,
        label: engine ? `${v.name} · ${engine}` : v.name,
        group: "My voices",
      };
    }),
    ...library.map((v) => ({ value: v.id, label: v.name, group: "Library" })),
  ];
  const webVoiceOptions: ComboboxOption[] = webSpeech.voices.map((v) => ({
    value: v.voiceURI,
    label: `${v.name} (${v.lang})`,
  }));
  const voiceOptions = isPreview ? webVoiceOptions : serverVoiceOptions;

  const providerOptions: ComboboxOption[] = configured.map((p) => ({
    value: p.id,
    label: p.label,
  }));

  const effectiveVoice = isPreview
    ? voiceId && webSpeech.voices.some((v) => v.voiceURI === voiceId)
      ? voiceId
      : (webSpeech.voices[0]?.voiceURI ?? "")
    : voiceId && voicesForPicker.some((v) => v.id === voiceId)
      ? voiceId
      : (voicesForPicker[0]?.id ?? "");

  const generate = useGenerateTake(scriptId);
  const kokoro = useKokoroGenerate(scriptId);
  const del = useDeleteTake(scriptId);
  const qc = useQueryClient();
  const [serverProgress, setServerProgress] = React.useState<VoiceGenerationProgress | null>(null);

  function runKokoro() {
    const voiceName = voices?.find((v) => v.id === effectiveVoice)?.name;
    kokoro.mutate(
      {
        scenes,
        voiceId: effectiveVoice,
        modelId: effectiveModel || undefined,
        label: voiceName ? `Kokoro · ${voiceName}` : "Kokoro (in-browser)",
      },
      {
        onSuccess: (take) => {
          onSelectTake(take.id);
          toast.success("Voice take generated", {
            description: `${take.timeline.length} scenes · ${(
              take.totalFrames / take.fps
            ).toFixed(1)}s`,
          });
        },
        onError: (e) => {
          if ((e as Error).name === "AbortError") return; // user cancelled
          toast.error("Generation failed", {
            description: (e as Error).message,
          });
        },
      },
    );
  }

  function runPreview() {
    const text =
      scenes.map((s) => s.text).filter(Boolean).join(". ") ||
      "No scene text to preview.";
    webSpeech.preview(text, effectiveVoice || undefined);
  }

  function resolveVoiceName(take: VoiceTakeDTO): string {
    // Try to resolve from currently loaded voices (works for current provider's takes)
    const found = voices?.find((v) => v.id === take.voiceId)?.name;
    if (found) return found;
    // Fallback: voiceId itself (often a human-readable slug for cloned voices)
    return take.voiceId || take.providerId;
  }

  function runGenerate(placeholder: boolean) {
    const voiceName = voices?.find((v) => v.id === effectiveVoice)?.name;
    const providerLabel = configured.find((p) => p.id === effectiveProvider)?.label;
    const modelLabel = models?.find((m) => m.id === effectiveModel)?.label;
    const label = placeholder
      ? undefined
      : [voiceName, providerLabel, modelLabel || effectiveModel || undefined]
          .filter(Boolean)
          .join(" · ");

    setServerProgress(null);
    generate.mutate(
      placeholder
        ? { placeholder: true, onProgress: setServerProgress }
        : {
            providerId: effectiveProvider,
            voiceId: effectiveVoice,
            modelId: effectiveModel || undefined,
            label,
            onProgress: setServerProgress,
          },
      {
        onSuccess: (take) => {
          setServerProgress(null);
          onSelectTake(take.id);
          toast.success(
            placeholder ? "Placeholder take created" : "Voice take generated",
            {
              description: `${take.timeline.length} scenes · ${(
                take.totalFrames / take.fps
              ).toFixed(1)}s`,
            },
          );
        },
        onError: (e) => {
          setServerProgress(null);
          toast.error("Generation failed", {
            description: (e as Error).message,
          });
        },
      },
    );
  }

  const canGenerateReal = Boolean(effectiveProvider && effectiveVoice);

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* ---- Left: controls ---- */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Generate voiceover</h3>

        {configured.length === 0 ? (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            No provider configured. Add a key in{" "}
            <Link href="/settings" className="text-primary underline">
              Settings
            </Link>{" "}
            to use a real voice, or create a silent placeholder below.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label>Provider</Label>
              <Combobox
                value={effectiveProvider ?? ""}
                onChange={(v) => {
                  setProviderId(v as ProviderId);
                  setVoiceId("");
                  setModelId("");
                }}
                options={providerOptions}
                placeholder="Select provider…"
                searchPlaceholder="Search providers…"
              />
            </div>
            {!isPreview && (
              <div className="grid gap-1.5">
                <Label>{isVoiceforge ? "Engine" : "Model"}</Label>
                <Combobox
                  value={effectiveModel}
                  onChange={(v) => {
                    setModelId(v);
                    // Drop the previous voice so we re-pick one for this engine.
                    if (isVoiceforge) setVoiceId("");
                  }}
                  options={modelOptions}
                  placeholder={
                    isVoiceforge ? "Select engine…" : "Select model…"
                  }
                  searchPlaceholder={
                    isVoiceforge ? "Search engines…" : "Search models…"
                  }
                  disabled={modelOptions.length === 0}
                />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>Voice</Label>
              <Combobox
                value={effectiveVoice}
                onChange={setVoiceId}
                options={voiceOptions}
                placeholder={
                  isPreview && !webSpeech.supported
                    ? "Not supported in this browser"
                    : voiceOptions.length === 0
                      ? voicesLoading || isPreview
                        ? "Loading voices…"
                        : isVoiceforge && effectiveModel
                          ? `No ready voices for ${effectiveModel}`
                          : "No voices"
                      : "Select voice…"
                }
                searchPlaceholder="Search voices…"
                disabled={
                  voiceOptions.length === 0 || (isPreview && !webSpeech.supported)
                }
              />
            </div>
            {isVoiceforge ? (
              <VoiceCloneDialog
                configured={Boolean(selectedStatus?.configured)}
                preferredEngineId={effectiveModel || undefined}
                onVoiceReady={() => {
                  qc.invalidateQueries({ queryKey: ["voices", "voiceforge"] });
                  qc.invalidateQueries({ queryKey: ["models", "voiceforge"] });
                }}
              />
            ) : null}
            {isVoiceforge ? (
              <p className="text-xs text-muted-foreground">
                {voiceforgeEngineHelperText(effectiveModel)} Pick a cloned voice
                built with this engine — synthesis always uses that voice&apos;s
                engine.
              </p>
            ) : null}
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1">
          {isPreview ? (
            <>
              <Button
                onClick={runPreview}
                disabled={!hasScenes || !webSpeech.supported}
              >
                <Volume2 />
                Preview voice
              </Button>
              <Button variant="ghost" size="sm" onClick={webSpeech.stop}>
                <Square />
                Stop
              </Button>
              <p className="text-xs text-muted-foreground">
                Preview only — browser speech can&apos;t be rendered. Use Kokoro
                or a provider to create a take.
              </p>
            </>
          ) : isKokoro ? (
            <>
              <Button
                onClick={runKokoro}
                disabled={!hasScenes || !effectiveVoice || kokoro.isPending}
              >
                {kokoro.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Cpu />
                )}
                Generate in browser
              </Button>
              {kokoro.isPending ? (
                <>
                  <Button variant="ghost" size="sm" onClick={kokoro.cancel}>
                    <Square />
                    Cancel
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {kokoroProgressLabel(kokoro.progress)}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Free, runs on your device in the background. First run downloads
                  the voice model (~80&nbsp;MB), then it&apos;s cached.
                </p>
              )}
            </>
          ) : (
            <>
              <Button
                onClick={() => runGenerate(false)}
                disabled={!hasScenes || !canGenerateReal || generate.isPending}
              >
                {generate.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Wand2 />
                )}
                Generate take
              </Button>
              {generate.isPending && serverProgress ? (
                <p className="text-xs text-muted-foreground">
                  {serverProgressLabel(serverProgress, effectiveProvider)}
                </p>
              ) : null}
            </>
          )}
          <Button
            variant="outline"
            onClick={() => runGenerate(true)}
            disabled={!hasScenes || generate.isPending}
          >
            <Sparkles />
            Silent placeholder (no credits)
          </Button>
        </div>
      </div>

      {/* ---- Right: takes list ---- */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Takes</h3>
          <span className="text-xs text-muted-foreground">
            {takes.length} saved
          </span>
        </div>

        {takes.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No takes yet. Generate one to hear your script with synced timing.
          </p>
        ) : (
          <ul className="space-y-2">
            {takes.map((take) => {
              const active = take.id === selectedTakeId;
              const voiceName = resolveVoiceName(take);
              const modelLabel =
                models?.find((m) => m.id === take.modelId)?.label ?? take.modelId;

              return (
                <li
                  key={take.id}
                  className={cn(
                    "rounded-lg border p-3",
                    active ? "border-primary ring-1 ring-primary" : "",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Mic className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium leading-snug">
                          {take.isPlaceholder ? "Silent placeholder" : voiceName}
                        </span>
                        {take.isPlaceholder ? (
                          <Badge variant="secondary">Placeholder</Badge>
                        ) : (
                          <Badge variant="success">{take.providerId}</Badge>
                        )}
                        {!take.isPlaceholder && modelLabel ? (
                          <Badge variant="outline" className="text-xs font-normal">
                            {modelLabel}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatTakeDate(take.createdAt)} &middot;{" "}
                        {(take.totalFrames / take.fps).toFixed(1)}s &middot;{" "}
                        {take.timeline.length} scenes
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        variant={active ? "secondary" : "ghost"}
                        onClick={() => active ? onClearTake?.() : onSelectTake(take.id)}
                        title={active ? "Click to deselect and use estimated timing" : "Use this take"}
                      >
                        {active ? "In preview ×" : "Use"}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        aria-label="Delete take"
                        onClick={() =>
                          del.mutate(take.id, {
                            onSuccess: () => toast.info("Take deleted"),
                          })
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <audio
                    className="mt-2 h-8 w-full"
                    controls
                    preload="metadata"
                    src={take.audioUrl}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
