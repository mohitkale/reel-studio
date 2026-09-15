"use client";

import * as React from "react";
import { Captions, Download, FileUp, Loader2, Mic2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  useLocalTranscriptionStatus,
  useReplaceCaptions,
  useSetCaptionTrackEnabled,
  useUpdateCaptionStyle,
  useUpdateCaptionCue,
} from "@/hooks/script";
import type { CaptionCueDTO, CaptionTrackDTO } from "@/lib/dto";
import { CaptionStyleControls } from "@/components/editor/caption-style-controls";

const SOURCE_LABELS: Record<CaptionTrackDTO["timingSource"], string> = {
  provider: "Provider timing",
  "local-transcription": "Local transcription",
  imported: "Imported timing",
  estimated: "Estimated timing",
};

function CueEditor({
  cue,
  fps,
  saving,
  onSave,
}: {
  cue: CaptionCueDTO;
  fps: number;
  saving: boolean;
  onSave: (value: {
    text: string;
    startFrame: number;
    endFrame: number;
  }) => void;
}) {
  const [text, setText] = React.useState(cue.text);
  const [start, setStart] = React.useState((cue.startFrame / fps).toFixed(2));
  const [end, setEnd] = React.useState((cue.endFrame / fps).toFixed(2));

  function save() {
    const startFrame = Math.max(0, Math.round(Number(start) * fps));
    const endFrame = Math.max(1, Math.round(Number(end) * fps));
    if (
      !text.trim() ||
      !Number.isFinite(startFrame) ||
      !Number.isFinite(endFrame)
    ) {
      toast.error("Enter caption text and valid times");
      return;
    }
    if (endFrame <= startFrame) {
      toast.error("Caption end time must be after its start time");
      return;
    }
    if (
      text.trim() === cue.text &&
      startFrame === cue.startFrame &&
      endFrame === cue.endFrame
    ) {
      return;
    }
    onSave({ text: text.trim(), startFrame, endFrame });
  }

  return (
    <div className="bg-background space-y-2 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-7 text-xs tabular-nums">
          {cue.order + 1}
        </span>
        <label className="text-muted-foreground flex flex-1 items-center gap-2 text-xs">
          Start
          <Input
            aria-label={`Caption ${cue.order + 1} start time in seconds`}
            className="h-8 w-24"
            inputMode="decimal"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            onBlur={save}
          />
        </label>
        <label className="text-muted-foreground flex flex-1 items-center gap-2 text-xs">
          End
          <Input
            aria-label={`Caption ${cue.order + 1} end time in seconds`}
            className="h-8 w-24"
            inputMode="decimal"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            onBlur={save}
          />
        </label>
        {saving ? (
          <Loader2 className="text-muted-foreground size-3.5 animate-spin" />
        ) : null}
      </div>
      <Textarea
        aria-label={`Caption ${cue.order + 1} text`}
        className="min-h-16 resize-y"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={save}
      />
    </div>
  );
}

export function CaptionsMenu({
  scriptId,
  takeId,
  tracks,
  fps,
  disabled,
}: {
  scriptId: string;
  takeId: string | null;
  tracks: CaptionTrackDTO[];
  fps: number;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [selectedTrackId, setSelectedTrackId] = React.useState<string | null>(
    null,
  );
  const inputRef = React.useRef<HTMLInputElement>(null);
  const replace = useReplaceCaptions(scriptId);
  const setEnabled = useSetCaptionTrackEnabled(scriptId);
  const updateCue = useUpdateCaptionCue(scriptId);
  const updateStyle = useUpdateCaptionStyle(scriptId);
  const transcription = useLocalTranscriptionStatus(open);
  const busy = replace.isPending || setEnabled.isPending;
  const activeTrack = tracks.find((candidate) => candidate.enabled);
  const track =
    tracks.find((candidate) => candidate.id === selectedTrackId) ??
    activeTrack ??
    tracks[0];

  function download(format: "srt" | "vtt") {
    const params = new URLSearchParams({ format });
    if (takeId) params.set("takeId", takeId);
    if (track) params.set("trackId", track.id);
    const anchor = document.createElement("a");
    anchor.href = `/api/scripts/${scriptId}/captions?${params.toString()}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  async function importFile(file: File) {
    const format = file.name.toLowerCase().endsWith(".vtt") ? "vtt" : "srt";
    try {
      const created = await replace.mutateAsync({
        action: "import",
        format,
        content: await file.text(),
        label: file.name,
      });
      setSelectedTrackId(created.id);
      toast.success("Caption track imported");
    } catch (error) {
      toast.error("Caption import failed", {
        description: (error as Error).message,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <HintTooltip
        label="Edit, align, import, or download subtitles"
        side="bottom"
      >
        <DialogTrigger asChild>
          <Button
            size="sm"
            variant={activeTrack ? "default" : "outline"}
            disabled={disabled}
          >
            <Captions className="size-3.5" />
            Captions
          </Button>
        </DialogTrigger>
      </HintTooltip>
      <DialogContent className="max-h-[86vh] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-5 pr-12">
          <div className="flex items-center gap-2">
            <DialogTitle>Captions</DialogTitle>
            {track ? (
              <Badge
                variant={
                  track.timingSource === "estimated" ? "warning" : "success"
                }
              >
                {SOURCE_LABELS[track.timingSource]}
              </Badge>
            ) : null}
          </div>
          <DialogDescription>
            Subtitles stay separate from scene headlines and render through both
            video engines.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto px-6 pb-6">
          {track?.timingSource === "estimated" ? (
            <p className="border-warning/30 bg-warning/10 text-warning rounded-lg border p-3 text-sm">
              Timing is estimated from scene durations. Review the sync before
              publishing, import timed subtitles, or use local transcription.
            </p>
          ) : null}

          {tracks.length > 1 ? (
            <label className="text-muted-foreground block space-y-1.5 text-xs">
              Caption track
              <NativeSelect
                value={track?.id ?? ""}
                onChange={(event) => setSelectedTrackId(event.target.value)}
              >
                {tracks.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.label}
                    {candidate.enabled ? " · included" : ""}
                  </option>
                ))}
              </NativeSelect>
            </label>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                replace.mutate(
                  {
                    action: "estimate",
                    takeId: takeId ?? undefined,
                    trackId: track?.id,
                  },
                  {
                    onSuccess: (created) => {
                      setSelectedTrackId(created.id);
                      toast.success("Estimated captions ready");
                    },
                    onError: (error) =>
                      toast.error("Could not estimate captions", {
                        description: error.message,
                      }),
                  },
                )
              }
            >
              <Wand2 className="size-3.5" />
              {track ? "Re-estimate" : "Create captions"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <FileUp className="size-3.5" /> Import SRT/VTT
            </Button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".srt,.vtt,text/vtt,application/x-subrip"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importFile(file);
                event.currentTarget.value = "";
              }}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !takeId || !transcription.data?.available}
              title={transcription.data?.reason ?? undefined}
              onClick={() => {
                if (!takeId) return;
                replace.mutate(
                  { action: "transcribe", takeId, trackId: track?.id },
                  {
                    onSuccess: (created) => {
                      setSelectedTrackId(created.id);
                      toast.success("Local transcription ready");
                    },
                    onError: (error) =>
                      toast.error("Transcription failed", {
                        description: error.message,
                      }),
                  },
                );
              }}
            >
              <Mic2 className="size-3.5" /> Transcribe locally
            </Button>
            {track ? (
              <Button
                size="sm"
                variant={track.enabled ? "default" : "outline"}
                disabled={busy}
                onClick={() =>
                  setEnabled.mutate({
                    trackId: track.id,
                    enabled: !track.enabled,
                  })
                }
              >
                {track.enabled ? "Included in video" : "Include in video"}
              </Button>
            ) : null}
          </div>

          {!transcription.isLoading && !transcription.data?.available ? (
            <p className="text-muted-foreground text-xs">
              Local transcription is optional. {transcription.data?.reason}
            </p>
          ) : null}

          {track ? (
            <CaptionStyleControls
              key={`${track.id}:${track.updatedAt}`}
              value={track.style}
              saving={updateStyle.isPending}
              onSave={(style) =>
                updateStyle.mutate(
                  { trackId: track.id, style },
                  {
                    onSuccess: () => toast.success("Caption style saved"),
                    onError: (error) =>
                      toast.error("Could not save caption style", {
                        description: error.message,
                      }),
                  },
                )
              }
            />
          ) : null}

          {track?.cues.length ? (
            <div className="space-y-2">
              {track.cues.map((cue) => (
                <CueEditor
                  key={`${cue.id}:${cue.startFrame}:${cue.endFrame}:${cue.text}`}
                  cue={cue}
                  fps={fps}
                  saving={
                    updateCue.isPending && updateCue.variables?.cueId === cue.id
                  }
                  onSave={(value) =>
                    updateCue.mutate(
                      { cueId: cue.id, ...value },
                      {
                        onError: (error) =>
                          toast.error("Caption update failed", {
                            description: error.message,
                          }),
                      },
                    )
                  }
                />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
              Create estimated captions or import an SRT/VTT file to begin
              editing.
            </p>
          )}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              size="sm"
              variant="outline"
              disabled={!track}
              onClick={() => download("srt")}
            >
              <Download className="size-3.5" /> SRT
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!track}
              onClick={() => download("vtt")}
            >
              <Download className="size-3.5" /> VTT
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
