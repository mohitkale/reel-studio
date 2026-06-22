"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Mic, Sparkles, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import type { VoiceTakeDTO } from "@/lib/dto";
import type { ProviderId } from "@/providers/voice/types";
import { useProviders, useModels, useVoices } from "@/hooks/voice";
import { useGenerateTake, useDeleteTake } from "@/hooks/script";
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

export function VoiceoverPanel({
  scriptId,
  takes,
  selectedTakeId,
  onSelectTake,
  onClearTake,
  hasScenes,
}: {
  scriptId: string;
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

  const { data: voices, isLoading: voicesLoading } = useVoices(effectiveProvider, "");
  const { data: models } = useModels(effectiveProvider);

  const mine = (voices ?? []).filter(
    (v) => v.category === "cloned" || v.category === "professional",
  );
  const library = (voices ?? []).filter(
    (v) => v.category === "default" || v.category === "shared",
  );

  const voiceOptions: ComboboxOption[] = [
    ...mine.map((v) => ({ value: v.id, label: v.name, group: "My voices" })),
    ...library.map((v) => ({ value: v.id, label: v.name, group: "Library" })),
  ];

  const providerOptions: ComboboxOption[] = configured.map((p) => ({
    value: p.id,
    label: p.label,
  }));

  const modelOptions: ComboboxOption[] = (models ?? []).map((m) => ({
    value: m.id,
    label: m.label,
  }));

  const effectiveVoice =
    voiceId && voices?.some((v) => v.id === voiceId)
      ? voiceId
      : (voices?.[0]?.id ?? "");
  const effectiveModel =
    modelId && models?.some((m) => m.id === modelId)
      ? modelId
      : (models?.[0]?.id ?? "");

  const generate = useGenerateTake(scriptId);
  const del = useDeleteTake(scriptId);

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

    generate.mutate(
      placeholder
        ? { placeholder: true }
        : {
            providerId: effectiveProvider,
            voiceId: effectiveVoice,
            modelId: effectiveModel || undefined,
            label,
          },
      {
        onSuccess: (take) => {
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
        onError: (e) =>
          toast.error("Generation failed", {
            description: (e as Error).message,
          }),
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
            <div className="grid gap-1.5">
              <Label>Voice</Label>
              <Combobox
                value={effectiveVoice}
                onChange={setVoiceId}
                options={voiceOptions}
                placeholder={voicesLoading ? "Loading voices…" : "Select voice…"}
                searchPlaceholder="Search voices…"
                disabled={voicesLoading || voiceOptions.length === 0}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Model</Label>
              <Combobox
                value={effectiveModel}
                onChange={setModelId}
                options={modelOptions}
                placeholder="Select model…"
                searchPlaceholder="Search models…"
                disabled={modelOptions.length === 0}
              />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1">
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
