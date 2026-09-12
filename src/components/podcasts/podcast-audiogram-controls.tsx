"use client";

import * as React from "react";
import { Download, Film, Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { PodcastAudiogramJobDTO, PodcastTakeDTO } from "@/lib/dto";
import { useGeneratePodcastAudiogram } from "@/hooks/podcasts";
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

export function PodcastAudiogramControls({ take }: { take: PodcastTakeDTO }) {
  const generate = useGeneratePodcastAudiogram();
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
