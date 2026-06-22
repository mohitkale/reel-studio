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
import { NativeSelect } from "@/components/ui/native-select";

function VoiceSelect({
  providerId,
  value,
  onChange,
}: {
  providerId: ProviderId | undefined;
  value: string;
  onChange: (id: string) => void;
}) {
  const { data: voices, isLoading } = useVoices(providerId, "");
  const mine = (voices ?? []).filter(
    (v) => v.category === "cloned" || v.category === "professional",
  );
  const library = (voices ?? []).filter(
    (v) => v.category === "default" || v.category === "shared",
  );

  return (
    <NativeSelect
      aria-label="Voice"
      value={value}
      disabled={isLoading || !voices?.length}
      onChange={(e) => onChange(e.target.value)}
    >
      {isLoading ? <option>Loading voices...</option> : null}
      {!isLoading && !voices?.length ? <option>No voices</option> : null}
      {mine.length ? (
        <optgroup label="My voices">
          {mine.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </optgroup>
      ) : null}
      {library.length ? (
        <optgroup label="Library">
          {library.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </optgroup>
      ) : null}
    </NativeSelect>
  );
}

export function VoiceoverPanel({
  scriptId,
  takes,
  selectedTakeId,
  onSelectTake,
  hasScenes,
}: {
  scriptId: string;
  takes: VoiceTakeDTO[];
  selectedTakeId: string | null;
  onSelectTake: (id: string) => void;
  hasScenes: boolean;
}) {
  const { data: providersData } = useProviders();
  const configured = (providersData?.providers ?? []).filter((p) => p.configured);

  const [providerId, setProviderId] = React.useState<ProviderId | undefined>();
  const [voiceId, setVoiceId] = React.useState("");
  const [modelId, setModelId] = React.useState("");

  // Derive effective provider without an effect (first configured by default).
  const effectiveProvider =
    providerId ?? providersData?.config.defaultProviderId ?? configured[0]?.id;

  const { data: voices } = useVoices(effectiveProvider, "");
  const { data: models } = useModels(effectiveProvider);

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

  function runGenerate(placeholder: boolean) {
    generate.mutate(
      placeholder
        ? { placeholder: true }
        : {
            providerId: effectiveProvider,
            voiceId: effectiveVoice,
            modelId: effectiveModel || undefined,
          },
      {
        onSuccess: (take) => {
          onSelectTake(take.id);
          toast.success(
            placeholder ? "Placeholder take created" : "Voice take generated",
            {
              description: `${take.timeline.length} scenes, ${(
                take.totalFrames / take.fps
              ).toFixed(1)}s.`,
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
              <NativeSelect
                value={effectiveProvider ?? ""}
                onChange={(e) => {
                  setProviderId(e.target.value as ProviderId);
                  setVoiceId("");
                  setModelId("");
                }}
              >
                {configured.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label>Voice</Label>
              <VoiceSelect
                providerId={effectiveProvider}
                value={effectiveVoice}
                onChange={setVoiceId}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Model</Label>
              <NativeSelect
                value={effectiveModel}
                disabled={!models?.length}
                onChange={(e) => setModelId(e.target.value)}
              >
                {(models ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </NativeSelect>
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
              return (
                <li
                  key={take.id}
                  className={cn(
                    "rounded-lg border p-3",
                    active ? "border-primary ring-1 ring-primary" : "",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Mic className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {take.label ?? "Take"}
                    </span>
                    {take.isPlaceholder ? (
                      <Badge variant="secondary">Placeholder</Badge>
                    ) : (
                      <Badge variant="success">{take.providerId}</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {(take.totalFrames / take.fps).toFixed(1)}s ·{" "}
                      {take.timeline.length} scenes
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        size="sm"
                        variant={active ? "secondary" : "ghost"}
                        onClick={() => onSelectTake(take.id)}
                      >
                        {active ? "In preview" : "Use"}
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
                    preload="none"
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
