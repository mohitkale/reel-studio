"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Cpu,
  Loader2,
  Mic,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import type {
  SceneDTO,
  SceneVoiceClipDTO,
  VoiceMode,
  VoiceTakeDTO,
} from "@/lib/dto";
import type { ProviderId } from "@/providers/voice/types";
import { voiceforgeEngineHelperText } from "@/providers/voice/voiceforge-engines";
import { useProviders, useModels, useVoices } from "@/hooks/voice";
import { VoiceCloneDialog } from "@/components/voice/voice-clone-dialog";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGenerateTake,
  useDeleteTake,
  useSetVoiceMode,
  type VoiceGenerationProgress,
} from "@/hooks/script";
import {
  useGenerateAllSceneClips,
  useGenerateSceneClip,
  useDeleteSceneClip,
  useSelectSceneClip,
  useAssembleSceneClips,
} from "@/hooks/scene-voice";
import {
  useKokoroGenerate,
  useKokoroGenerateSceneClips,
  useKokoroGenerateOneSceneClip,
  useWebSpeechPreview,
  type KokoroGenerateProgress,
} from "@/hooks/client-tts";
import { hasSpokenContent, resolveSpokenText } from "@/lib/spoken-text";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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

function VoiceModeToggle({
  value,
  onChange,
  disabled,
}: {
  value: VoiceMode;
  onChange: (mode: VoiceMode) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="inline-flex items-center rounded-lg border bg-muted/40 p-0.5"
      role="group"
      aria-label="Voice mode"
    >
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={disabled}
        className={cn(
          "h-7 rounded-md px-2.5 text-xs",
          value === "oneshot" && "bg-background text-foreground shadow-sm",
        )}
        aria-pressed={value === "oneshot"}
        onClick={() => onChange("oneshot")}
      >
        One shot
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={disabled}
        className={cn(
          "h-7 rounded-md px-2.5 text-xs",
          value === "per_scene" && "bg-background text-foreground shadow-sm",
        )}
        aria-pressed={value === "per_scene"}
        onClick={() => onChange("per_scene")}
      >
        Scene by scene
      </Button>
    </div>
  );
}

export function VoiceoverPanel({
  scriptId,
  scenes,
  takes,
  voiceClips,
  voiceMode,
  selectedTakeId,
  selectedSceneId,
  onSelectTake,
  onClearTake,
  onSelectScene,
  hasScenes,
}: {
  scriptId: string;
  scenes: SceneDTO[];
  takes: VoiceTakeDTO[];
  voiceClips: SceneVoiceClipDTO[];
  voiceMode: VoiceMode;
  selectedTakeId: string | null;
  selectedSceneId?: string | null;
  onSelectTake: (id: string) => void;
  onClearTake?: () => void;
  onSelectScene?: (id: string) => void;
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

  const webSpeech = useWebSpeechPreview();

  const modelOptions: ComboboxOption[] = (models ?? []).map((m) => ({
    value: m.id,
    label: m.label,
  }));

  const effectiveModel =
    modelId && models?.some((m) => m.id === modelId)
      ? modelId
      : (models?.[0]?.id ?? "");

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

  const setVoiceMode = useSetVoiceMode(scriptId);
  const generate = useGenerateTake(scriptId);
  const kokoro = useKokoroGenerate(scriptId);
  const kokoroClips = useKokoroGenerateSceneClips(scriptId);
  const kokoroOneClip = useKokoroGenerateOneSceneClip(scriptId);
  const del = useDeleteTake(scriptId);
  const generateAllClips = useGenerateAllSceneClips(scriptId);
  const generateOneClip = useGenerateSceneClip(scriptId);
  const deleteClip = useDeleteSceneClip(scriptId);
  const selectClip = useSelectSceneClip(scriptId);
  const assemble = useAssembleSceneClips(scriptId);
  const qc = useQueryClient();
  const [serverProgress, setServerProgress] =
    React.useState<VoiceGenerationProgress | null>(null);

  const [clipTab, setClipTab] = React.useState<string | null>(null);

  const tabValue =
    (selectedSceneId && scenes.some((s) => s.id === selectedSceneId)
      ? selectedSceneId
      : null) ??
    (clipTab && scenes.some((s) => s.id === clipTab) ? clipTab : null) ??
    scenes[0]?.id ??
    "";

  const canGenerateReal = Boolean(effectiveProvider && effectiveVoice);
  const isBusy =
    generate.isPending ||
    kokoro.isPending ||
    kokoroClips.isPending ||
    kokoroOneClip.isPending ||
    generateAllClips.isPending ||
    generateOneClip.isPending ||
    assemble.isPending;

  const freshClipCount = scenes.filter((s) => {
    const spoken = resolveSpokenText(s);
    const sel = voiceClips.find((c) => c.id === s.selectedVoiceClipId);
    return sel && sel.text === spoken;
  }).length;

  function buildLabel(placeholder: boolean): string | undefined {
    if (placeholder) return undefined;
    const voiceName = voices?.find((v) => v.id === effectiveVoice)?.name;
    const providerLabel = configured.find((p) => p.id === effectiveProvider)?.label;
    const modelLabel = models?.find((m) => m.id === effectiveModel)?.label;
    return [voiceName, providerLabel, modelLabel || effectiveModel || undefined]
      .filter(Boolean)
      .join(" · ");
  }

  function resolveVoiceName(take: VoiceTakeDTO): string {
    const found = voices?.find((v) => v.id === take.voiceId)?.name;
    if (found) return found;
    return take.voiceId || take.providerId;
  }

  function onModeChange(mode: VoiceMode) {
    if (mode === voiceMode) return;
    setVoiceMode.mutate(mode, {
      onError: (e) =>
        toast.error("Could not switch voice mode", {
          description: (e as Error).message,
        }),
    });
  }

  function runKokoroOneshot() {
    const voiceName = voices?.find((v) => v.id === effectiveVoice)?.name;
    kokoro.mutate(
      {
        scenes: scenes.map((s) => ({
          id: s.id,
          text: resolveSpokenText(s),
        })),
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
          if ((e as Error).name === "AbortError") return;
          toast.error("Generation failed", {
            description: (e as Error).message,
          });
        },
      },
    );
  }

  function runKokoroAllClips() {
    const voiceName = voices?.find((v) => v.id === effectiveVoice)?.name;
    kokoroClips.mutate(
      {
        scenes: scenes.map((s) => ({
          id: s.id,
          text: resolveSpokenText(s),
        })),
        voiceId: effectiveVoice,
        modelId: effectiveModel || undefined,
        label: voiceName ? `Kokoro · ${voiceName}` : "Kokoro (in-browser)",
      },
      {
        onSuccess: ({ take }) => {
          if (take) onSelectTake(take.id);
          toast.success("Scene clips generated", {
            description: take
              ? `${take.timeline.length} scenes · ${(
                  take.totalFrames / take.fps
                ).toFixed(1)}s assembled`
              : "Clips saved",
          });
        },
        onError: (e) => {
          if ((e as Error).name === "AbortError") return;
          toast.error("Generation failed", {
            description: (e as Error).message,
          });
        },
      },
    );
  }

  function runKokoroOneClip(sceneId: string) {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) return;
    const voiceName = voices?.find((v) => v.id === effectiveVoice)?.name;
    kokoroOneClip.mutate(
      {
        scene: { id: scene.id, text: resolveSpokenText(scene) },
        voiceId: effectiveVoice,
        modelId: effectiveModel || undefined,
        label: voiceName ? `Kokoro · ${voiceName}` : "Kokoro (in-browser)",
      },
      {
        onSuccess: ({ take }) => {
          if (take) onSelectTake(take.id);
          toast.success("Scene clip generated");
        },
        onError: (e) => {
          if ((e as Error).name === "AbortError") return;
          toast.error("Generation failed", {
            description: (e as Error).message,
          });
        },
      },
    );
  }

  function runPreview() {
    const text =
      scenes.map((s) => resolveSpokenText(s)).filter(Boolean).join(". ") ||
      "No scene text to preview.";
    webSpeech.preview(text, effectiveVoice || undefined);
  }

  function runGenerateOneshot(placeholder: boolean) {
    setServerProgress(null);
    generate.mutate(
      placeholder
        ? { placeholder: true, onProgress: setServerProgress }
        : {
            providerId: effectiveProvider,
            voiceId: effectiveVoice,
            modelId: effectiveModel || undefined,
            label: buildLabel(false),
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

  function runGenerateAllClips(placeholder: boolean) {
    setServerProgress(null);
    generateAllClips.mutate(
      placeholder
        ? { placeholder: true, onProgress: setServerProgress }
        : {
            providerId: effectiveProvider,
            voiceId: effectiveVoice,
            modelId: effectiveModel || undefined,
            label: buildLabel(false),
            onProgress: setServerProgress,
          },
      {
        onSuccess: ({ take }) => {
          setServerProgress(null);
          if (take) onSelectTake(take.id);
          toast.success(
            placeholder
              ? "Placeholder scene clips created"
              : "Scene clips generated",
            {
              description: take
                ? `${take.timeline.length} scenes · ${(
                    take.totalFrames / take.fps
                  ).toFixed(1)}s assembled`
                : undefined,
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

  function runGenerateOneClip(sceneId: string, placeholder: boolean) {
    setServerProgress(null);
    generateOneClip.mutate(
      placeholder
        ? { sceneId, placeholder: true, onProgress: setServerProgress }
        : {
            sceneId,
            providerId: effectiveProvider,
            voiceId: effectiveVoice,
            modelId: effectiveModel || undefined,
            label: buildLabel(false),
            onProgress: setServerProgress,
          },
      {
        onSuccess: ({ take }) => {
          setServerProgress(null);
          if (take) onSelectTake(take.id);
          toast.success(
            placeholder ? "Placeholder clip created" : "Scene clip generated",
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

  function handleSelectClip(sceneId: string, clipId: string) {
    selectClip.mutate(
      { sceneId, clipId },
      {
        onSuccess: (data) => {
          if (data.take) {
            onSelectTake(data.take.id);
            toast.success("Clip selected · reel audio updated");
          } else {
            toast.info("Clip selected", {
              description: "Generate remaining scenes to assemble the full reel.",
            });
          }
        },
        onError: (e) =>
          toast.error("Could not select clip", {
            description: (e as Error).message,
          }),
      },
    );
  }

  function handleAssemble() {
    assemble.mutate(undefined, {
      onSuccess: (take) => {
        onSelectTake(take.id);
        toast.success("Assembled reel audio", {
          description: `${take.timeline.length} scenes · ${(
            take.totalFrames / take.fps
          ).toFixed(1)}s`,
        });
      },
      onError: (e) =>
        toast.error("Could not assemble", {
          description: (e as Error).message,
        }),
    });
  }

  const providerControls = (
    <>
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
    </>
  );

  const oneshotActions = (
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
            onClick={runKokoroOneshot}
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
            onClick={() => runGenerateOneshot(false)}
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
        onClick={() => runGenerateOneshot(true)}
        disabled={!hasScenes || generate.isPending}
      >
        <Sparkles />
        Silent placeholder (no credits)
      </Button>
    </div>
  );

  const perSceneActions = (
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
            Preview only — switch to Kokoro or a provider to create scene clips.
          </p>
        </>
      ) : isKokoro ? (
        <>
          <Button
            onClick={runKokoroAllClips}
            disabled={!hasScenes || !effectiveVoice || kokoroClips.isPending}
          >
            {kokoroClips.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Cpu />
            )}
            Generate all scenes
          </Button>
          {kokoroClips.isPending ? (
            <>
              <Button variant="ghost" size="sm" onClick={kokoroClips.cancel}>
                <Square />
                Cancel
              </Button>
              <p className="text-xs text-muted-foreground">
                {kokoroProgressLabel(kokoroClips.progress)}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Creates a clip per scene in parallel, then stitches the reel.
            </p>
          )}
        </>
      ) : (
        <>
          <Button
            onClick={() => runGenerateAllClips(false)}
            disabled={!hasScenes || !canGenerateReal || generateAllClips.isPending}
          >
            {generateAllClips.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Wand2 />
            )}
            Generate all scenes
          </Button>
          {generateAllClips.isPending && serverProgress ? (
            <p className="text-xs text-muted-foreground">
              {serverProgressLabel(serverProgress, effectiveProvider)}
            </p>
          ) : null}
        </>
      )}
      <Button
        variant="outline"
        onClick={() => runGenerateAllClips(true)}
        disabled={!hasScenes || generateAllClips.isPending}
      >
        <Sparkles />
        Silent placeholders (no credits)
      </Button>
      <div className="flex items-center justify-between gap-2 pt-1">
        <p className="text-xs text-muted-foreground">
          {freshClipCount}/{scenes.length} scenes ready
        </p>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleAssemble}
          disabled={freshClipCount < scenes.length || assemble.isPending}
        >
          {assemble.isPending ? (
            <Loader2 className="animate-spin" />
          ) : null}
          Assemble
        </Button>
      </div>
    </div>
  );

  const oneshotTakesList = (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Takes</h3>
        <span className="text-xs text-muted-foreground">
          {takes.filter((t) => t.source !== "assembled").length} saved
        </span>
      </div>

      {takes.filter((t) => t.source !== "assembled").length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No takes yet. Generate one to hear your script with synced timing.
        </p>
      ) : (
        <ul className="space-y-2">
          {takes
            .filter((t) => t.source !== "assembled")
            .map((take) => {
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
                        onClick={() =>
                          active ? onClearTake?.() : onSelectTake(take.id)
                        }
                        title={
                          active
                            ? "Click to deselect and use estimated timing"
                            : "Use this take"
                        }
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
  );

  const perSceneClipsPanel = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Scene clips</h3>
        <span className="text-xs text-muted-foreground">
          {freshClipCount}/{scenes.length} ready
        </span>
      </div>

      {scenes.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Add scenes first, then generate audio per scene.
        </p>
      ) : (
        <Tabs
          value={tabValue}
          onValueChange={(id) => {
            setClipTab(id);
            onSelectScene?.(id);
          }}
        >
          <TabsList className="mb-2 flex h-auto w-full flex-wrap justify-start gap-1">
            {scenes.map((s, i) => {
              const sel = voiceClips.find((c) => c.id === s.selectedVoiceClipId);
              const spokenForTab = resolveSpokenText(s);
              const stale = sel && sel.text !== spokenForTab;
              const ready = sel && sel.text === spokenForTab;
              return (
                <TabsTrigger
                  key={s.id}
                  value={s.id}
                  className="relative px-2.5 text-xs"
                >
                  {i + 1}
                  {ready ? (
                    <span className="ml-1 size-1.5 rounded-full bg-emerald-500" />
                  ) : stale ? (
                    <AlertTriangle className="ml-1 size-3 text-amber-500" />
                  ) : null}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {scenes.map((scene, index) => {
            const clips = voiceClips.filter((c) => c.sceneId === scene.id);
            const selected = scene.selectedVoiceClipId;
            const selectedClip = clips.find((c) => c.id === selected);
            const spoken = resolveSpokenText(scene);
            const stale =
              selectedClip != null && selectedClip.text !== spoken;

            return (
              <TabsContent key={scene.id} value={scene.id} className="space-y-3">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Scene {index + 1} · spoken text
                  </p>
                  {hasSpokenContent(scene) ? (
                    <p className="mt-1 text-sm leading-snug">{spoken}</p>
                  ) : (
                    <p className="mt-1 text-sm text-amber-600">
                      No spoken text on this scene. Voice generation will use a
                      short silent hold — add a voice script in the scene
                      inspector to get real audio.
                    </p>
                  )}
                  {stale ? (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                      <AlertTriangle className="size-3.5" />
                      Selected clip is stale — text changed. Regenerate this scene.
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {isPreview ? null : isKokoro ? (
                    <Button
                      size="sm"
                      onClick={() =>
                        hasSpokenContent(scene)
                          ? runKokoroOneClip(scene.id)
                          : runGenerateOneClip(scene.id, true)
                      }
                      disabled={
                        hasSpokenContent(scene)
                          ? !effectiveVoice || kokoroOneClip.isPending
                          : generateOneClip.isPending
                      }
                    >
                      {(hasSpokenContent(scene)
                        ? kokoroOneClip.isPending
                        : generateOneClip.isPending) ? (
                        <Loader2 className="animate-spin" />
                      ) : hasSpokenContent(scene) ? (
                        <Cpu />
                      ) : (
                        <Sparkles />
                      )}
                      {hasSpokenContent(scene)
                        ? clips.length
                          ? "Regenerate"
                          : "Generate"
                        : "Add silent hold"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() =>
                        runGenerateOneClip(scene.id, !hasSpokenContent(scene))
                      }
                      disabled={
                        hasSpokenContent(scene)
                          ? !canGenerateReal || generateOneClip.isPending
                          : generateOneClip.isPending
                      }
                    >
                      {generateOneClip.isPending ? (
                        <Loader2 className="animate-spin" />
                      ) : hasSpokenContent(scene) ? (
                        <Wand2 />
                      ) : (
                        <Sparkles />
                      )}
                      {hasSpokenContent(scene)
                        ? clips.length
                          ? "Regenerate"
                          : "Generate"
                        : "Add silent hold"}
                    </Button>
                  )}
                  {hasSpokenContent(scene) ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runGenerateOneClip(scene.id, true)}
                      disabled={generateOneClip.isPending}
                    >
                      <Sparkles />
                      Silent
                    </Button>
                  ) : null}
                </div>

                {clips.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    No clips for this scene yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {clips.map((clip) => {
                      const active = clip.id === selected;
                      const clipStale = clip.text !== spoken;
                      return (
                        <li
                          key={clip.id}
                          className={cn(
                            "rounded-lg border p-3",
                            active ? "border-primary ring-1 ring-primary" : "",
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <Mic className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium">
                                  {clip.isPlaceholder
                                    ? "Silent placeholder"
                                    : clip.label || clip.providerId}
                                </span>
                                {clip.isPlaceholder ? (
                                  <Badge variant="secondary">Placeholder</Badge>
                                ) : (
                                  <Badge variant="success">{clip.providerId}</Badge>
                                )}
                                {clipStale ? (
                                  <Badge variant="outline" className="text-amber-600">
                                    Stale
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {formatTakeDate(clip.createdAt)} &middot;{" "}
                                {(clip.durationFrames / clip.fps).toFixed(1)}s
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                size="sm"
                                variant={active ? "secondary" : "ghost"}
                                disabled={clipStale || selectClip.isPending}
                                onClick={() =>
                                  handleSelectClip(scene.id, clip.id)
                                }
                              >
                                {active ? "Selected" : "Use"}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8 text-muted-foreground hover:text-destructive"
                                aria-label="Delete clip"
                                onClick={() =>
                                  deleteClip.mutate(clip.id, {
                                    onSuccess: () => toast.info("Clip deleted"),
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
                            src={clip.audioUrl}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      {selectedTakeId &&
      takes.find((t) => t.id === selectedTakeId)?.source === "assembled" ? (
        <p className="text-xs text-muted-foreground">
          Assembled take is active for Full reel preview and Render.
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Generate voiceover</h3>
          <p className="text-xs text-muted-foreground">
            {voiceMode === "oneshot"
              ? "One full take for the whole reel"
              : "Clips per scene — regenerate one without redoing the rest"}
          </p>
        </div>
        <VoiceModeToggle
          value={voiceMode}
          onChange={onModeChange}
          disabled={isBusy || setVoiceMode.isPending}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          {providerControls}
          {voiceMode === "oneshot" ? oneshotActions : perSceneActions}
        </div>

        {voiceMode === "oneshot" ? oneshotTakesList : perSceneClipsPanel}
      </div>
    </div>
  );
}
