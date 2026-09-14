"use client";

import * as React from "react";
import { Download, Film, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import type {
  PodcastAudiogramJobDTO,
  PodcastClipSuggestionDTO,
  PodcastTakeDTO,
} from "@/lib/dto";
import {
  useGeneratePodcastAudiogram,
  useGeneratePodcastClipSuggestions,
  usePodcastClipSuggestions,
} from "@/hooks/podcasts";
import { useAIModels, useAIProviders } from "@/hooks/ai";
import type { AIProviderId } from "@/providers/ai/types";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";

const ORIENTATIONS = [
  { value: "portrait", label: "Portrait · 9:16" },
  { value: "square", label: "Square · 1:1" },
  { value: "landscape", label: "Landscape · 16:9" },
] as const;

function stepLabel(step: string | null): string {
  if (!step) return "Queued";
  return step.replaceAll("_", " ");
}

function formatSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}

export function PodcastAudiogramControls({ take }: { take: PodcastTakeDTO }) {
  const generate = useGeneratePodcastAudiogram();
  const localSuggestions = usePodcastClipSuggestions(take.id);
  const generateSuggestions = useGeneratePodcastClipSuggestions();
  const { data: providers = [] } = useAIProviders();
  const configuredProviders = providers.filter(
    (provider) => provider.configured,
  );
  const [providerId, setProviderId] = React.useState<AIProviderId>();
  const selectedProviderId = providerId ?? configuredProviders[0]?.id;
  const { data: models = [] } = useAIModels(selectedProviderId);
  const [modelId, setModelId] = React.useState("");
  const [aiSuggestions, setAiSuggestions] = React.useState<
    PodcastClipSuggestionDTO[]
  >([]);
  const [startTurnId, setStartTurnId] = React.useState(
    take.timeline[0]?.turnId ?? "",
  );
  const [endTurnId, setEndTurnId] = React.useState(
    take.timeline[Math.min(2, take.timeline.length - 1)]?.turnId ?? "",
  );
  const [orientation, setOrientation] = React.useState<
    "portrait" | "landscape" | "square"
  >("portrait");
  const [job, setJob] = React.useState<PodcastAudiogramJobDTO | null>(null);
  const startIndex = take.timeline.findIndex(
    (beat) => beat.turnId === startTurnId,
  );
  const options = take.timeline.map((beat, index) => ({
    value: beat.turnId,
    label: `${index + 1}. ${beat.characterKey ?? "Speaker"} · ${beat.text.slice(0, 52)}${beat.text.length > 52 ? "…" : ""}`,
  }));
  const endOptions = options.slice(Math.max(0, startIndex));
  const suggestions = aiSuggestions.length
    ? aiSuggestions
    : (localSuggestions.data ?? []);

  function applySuggestion(suggestion: PodcastClipSuggestionDTO) {
    setStartTurnId(suggestion.startTurnId);
    setEndTurnId(suggestion.endTurnId);
  }

  async function askAi() {
    if (!selectedProviderId) return;
    try {
      const next = await generateSuggestions.mutateAsync({
        takeId: take.id,
        providerId: selectedProviderId,
        modelId: modelId || undefined,
      });
      setAiSuggestions(next);
      toast.success("AI clip suggestions ready");
    } catch (error) {
      toast.error("Could not suggest clips", {
        description: (error as Error).message,
      });
    }
  }

  async function run() {
    setJob(null);
    try {
      const completed = await generate.mutateAsync({
        takeId: take.id,
        startTurnId,
        endTurnId,
        orientation,
        onProgress: setJob,
      });
      setJob(completed);
      toast.success("Audiogram ready");
    } catch (error) {
      toast.error("Audiogram failed", {
        description: (error as Error).message,
      });
    }
  }

  return (
    <div className="border-border bg-muted/25 grid gap-2 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <Film className="text-muted-foreground size-4" />
        <span className="text-xs font-semibold">Create audiogram</span>
        <span className="text-muted-foreground text-[11px]">
          Uses this take&apos;s original audio
        </span>
      </div>
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_12rem_auto]">
        <Combobox
          value={startTurnId}
          onChange={(value) => {
            setStartTurnId(value);
            const nextStart = take.timeline.findIndex(
              (beat) => beat.turnId === value,
            );
            const currentEnd = take.timeline.findIndex(
              (beat) => beat.turnId === endTurnId,
            );
            if (currentEnd < nextStart) setEndTurnId(value);
          }}
          options={options}
          placeholder="Start turn"
        />
        <Combobox
          value={endTurnId}
          onChange={setEndTurnId}
          options={endOptions}
          placeholder="End turn"
        />
        <Combobox
          value={orientation}
          onChange={(value) =>
            setOrientation(value as "portrait" | "landscape" | "square")
          }
          options={[...ORIENTATIONS]}
        />
        <Button
          type="button"
          size="sm"
          disabled={!startTurnId || !endTurnId || generate.isPending}
          onClick={() => void run()}
        >
          {generate.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Film className="size-4" />
          )}
          Produce
        </Button>
      </div>
      <div className="border-border grid gap-2 border-t pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold">Suggested ranges</span>
          <span className="text-muted-foreground text-[11px]">
            Quotes and timestamps come directly from this saved take.
          </span>
          {configuredProviders.length ? (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="w-36">
                <Combobox
                  value={selectedProviderId ?? ""}
                  onChange={(value) => {
                    setProviderId(value as AIProviderId);
                    setModelId("");
                  }}
                  options={configuredProviders.map((provider) => ({
                    value: provider.id,
                    label: provider.label,
                  }))}
                  placeholder="AI provider"
                />
              </div>
              {models.length ? (
                <div className="w-44">
                  <Combobox
                    value={modelId}
                    onChange={setModelId}
                    options={models.map((model) => ({
                      value: model.id,
                      label: model.label,
                    }))}
                    placeholder="Default model"
                  />
                </div>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!selectedProviderId || generateSuggestions.isPending}
                onClick={() => void askAi()}
              >
                {generateSuggestions.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Ask AI
              </Button>
            </div>
          ) : null}
        </div>
        {suggestions.length ? (
          <div className="grid gap-2 md:grid-cols-3">
            {suggestions.map((suggestion) => (
              <button
                key={`${suggestion.startTurnId}:${suggestion.endTurnId}`}
                type="button"
                className="border-border hover:border-primary bg-background grid gap-1 rounded-md border p-2 text-left transition-colors"
                onClick={() => applySuggestion(suggestion)}
              >
                <span className="flex items-center justify-between gap-2 text-xs font-medium">
                  <span>{suggestion.label}</span>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {formatSeconds(suggestion.startSeconds)}–
                    {formatSeconds(suggestion.endSeconds)}
                  </span>
                </span>
                <span className="text-muted-foreground line-clamp-3 text-[11px]">
                  “{suggestion.quote}”
                </span>
              </button>
            ))}
          </div>
        ) : localSuggestions.isLoading ? (
          <span className="text-muted-foreground text-[11px]">
            Finding timestamped ranges…
          </span>
        ) : (
          <span className="text-muted-foreground text-[11px]">
            Choose the start and end turns manually for this short take.
          </span>
        )}
      </div>
      {generate.isPending && job ? (
        <div className="grid gap-1">
          <div className="text-muted-foreground flex justify-between text-[11px] capitalize">
            <span>{stepLabel(job.activeStep)}</span>
            <span>{Math.round(job.progress * 100)}%</span>
          </div>
          <div className="bg-muted h-1.5 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full transition-[width]"
              style={{ width: `${Math.round(job.progress * 100)}%` }}
            />
          </div>
        </div>
      ) : null}
      {job?.state === "succeeded" && job.outputUrl ? (
        <Button
          asChild
          type="button"
          size="sm"
          variant="secondary"
          className="w-fit"
        >
          <a href={job.outputUrl} download>
            <Download className="size-4" />
            Download MP4
          </a>
        </Button>
      ) : null}
    </div>
  );
}
