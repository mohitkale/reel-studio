"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useScript } from "@/hooks/script";
import { apiPost } from "@/lib/api-client";
import type { ScriptDTO } from "@/lib/dto";
import type { CutSuggestion } from "@/production/cut-suggestions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  musicBeatAnchors,
  type MusicMap,
  type MusicMapEdit,
} from "@/production/music-map";

export function MusicBeatMap({
  scriptId,
  disabled,
  onListen,
}: {
  scriptId: string;
  disabled?: boolean;
  onListen: (seconds: number) => void;
}) {
  const { data: script } = useScript(scriptId);
  const qc = useQueryClient();
  const analyze = useMutation({
    mutationFn: () =>
      apiPost<{ map: MusicMap; script: ScriptDTO }>(
        `/api/scripts/${scriptId}/music-map`,
        {},
      ),
    onSuccess: (data) => qc.setQueryData(["script", scriptId], data.script),
  });
  if (!script?.musicUrl) return null;
  return (
    <details className="rounded-lg border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Review music beats
      </summary>
      <div className="mt-3 grid gap-3">
        <p className="text-muted-foreground text-xs">
          Proposed beat timing for directing cuts. Listen and adjust; tempo can
          be ambiguous. Narration and scene timing stay as edited.
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || analyze.isPending}
          onClick={() => analyze.mutate()}
        >
          {analyze.isPending && <Loader2 className="size-3.5 animate-spin" />}
          {script.musicMap ? "Check selected track" : "Analyze selected music"}
        </Button>
        {analyze.isError && (
          <p role="alert" className="text-destructive text-xs">
            {analyze.error.message}
          </p>
        )}
        {script.musicMap && (
          <MusicBeatForm
            key={JSON.stringify(script.musicMap)}
            map={script.musicMap}
            scriptId={scriptId}
            disabled={disabled || analyze.isPending}
            onListen={onListen}
          />
        )}
        {script.musicMap && (
          <NarrationCutSuggestions
            key={JSON.stringify(script)}
            script={script}
            disabled={disabled}
            onListen={onListen}
          />
        )}
      </div>
    </details>
  );
}

function MusicBeatForm({
  map,
  scriptId,
  disabled,
  onListen,
}: {
  map: MusicMap;
  scriptId: string;
  disabled?: boolean;
  onListen: (seconds: number) => void;
}) {
  const qc = useQueryClient();
  const [bpm, setBpm] = React.useState(String(map.bpm));
  const [offset, setOffset] = React.useState(String(map.offsetSeconds));
  const [drop, setDrop] = React.useState(
    map.dropSeconds === null ? "" : String(map.dropSeconds),
  );
  const [disabledBeats, setDisabledBeats] = React.useState(map.disabledBeats);
  const [page, setPage] = React.useState(0);
  const save = useMutation({
    mutationFn: async (changes: MusicMapEdit["changes"]) => {
      const response = await fetch(`/api/scripts/${scriptId}/music-map`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expected: map, changes }),
      });
      const data = (await response.json()) as {
        script: ScriptDTO;
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error ?? "Music timing could not be saved.");
      return data;
    },
    onSuccess: (data) => qc.setQueryData(["script", scriptId], data.script),
    onSettled: () => qc.invalidateQueries({ queryKey: ["script", scriptId] }),
  });
  const anchors = musicBeatAnchors(map);
  const busy = disabled || save.isPending;
  const valid =
    bpm.trim() &&
    offset.trim() &&
    Number.isFinite(Number(bpm)) &&
    Number.isFinite(Number(offset)) &&
    (!drop.trim() || Number.isFinite(Number(drop)));
  return (
    <div className="grid gap-3">
      <p className="text-muted-foreground text-xs">
        {map.method === "manual"
          ? "Manual grid — set BPM and first beat by ear"
          : `Rhythm match: ${map.confidence >= 0.65 ? "strong" : map.confidence >= 0.4 ? "moderate" : "weak"} — review half/double tempo if needed`}
        {" · "}
        {map.durationSeconds.toFixed(2)}s track
      </p>
      <div className="grid grid-cols-3 gap-2">
        <Label className="grid gap-1 text-xs">
          BPM
          <Input
            aria-label="Music BPM"
            type="number"
            min={40}
            max={240}
            step="0.01"
            value={bpm}
            disabled={busy}
            onChange={(event) => setBpm(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1 text-xs">
          First beat (s)
          <Input
            aria-label="First music beat in seconds"
            type="number"
            min={0}
            step="0.01"
            value={offset}
            disabled={busy}
            onChange={(event) => setOffset(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1 text-xs">
          Drop (s, optional)
          <Input
            aria-label="Music drop in seconds"
            type="number"
            min={0}
            step="0.01"
            value={drop}
            disabled={busy}
            onChange={(event) => setDrop(event.target.value)}
          />
        </Label>
      </div>
      <Button
        size="sm"
        disabled={busy || !valid}
        onClick={() =>
          save.mutate({
            bpm: Number(bpm),
            offsetSeconds: Number(offset),
            dropSeconds: drop.trim() ? Number(drop) : null,
            disabledBeats,
          })
        }
      >
        {save.isPending && <Loader2 className="size-3.5 animate-spin" />} Save
        beat map
      </Button>
      {save.isError && (
        <p role="alert" className="text-destructive text-xs">
          {save.error.message}
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        Saved beats below. Select a beat to enable or disable it, then save.
        These choices repeat when the music loops.
      </p>
      <div className="grid grid-cols-4 gap-1">
        {anchors.slice(page * 16, page * 16 + 16).map((anchor) => (
          <Button
            key={anchor.index}
            size="sm"
            variant={disabledBeats.includes(anchor.index) ? "ghost" : "outline"}
            aria-label={`Music beat ${anchor.index + 1} at ${anchor.seconds.toFixed(2)} seconds`}
            aria-pressed={!disabledBeats.includes(anchor.index)}
            disabled={busy}
            onClick={() =>
              setDisabledBeats((beats) =>
                beats.includes(anchor.index)
                  ? beats.filter((beat) => beat !== anchor.index)
                  : [...beats, anchor.index].sort((a, b) => a - b),
              )
            }
          >
            <span
              className={
                disabledBeats.includes(anchor.index)
                  ? "line-through opacity-50"
                  : ""
              }
            >
              {anchor.seconds.toFixed(2)}s
            </span>
          </Button>
        ))}
      </div>
      {anchors.length > 16 && (
        <div className="flex items-center justify-between text-xs">
          <Button
            size="sm"
            variant="ghost"
            disabled={busy || page === 0}
            onClick={() => setPage(page - 1)}
          >
            Earlier beats
          </Button>
          <span>
            {page + 1} / {Math.ceil(anchors.length / 16)}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy || (page + 1) * 16 >= anchors.length}
            onClick={() => setPage(page + 1)}
          >
            Later beats
          </Button>
        </div>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onListen(map.offsetSeconds)}
        >
          Listen from first beat
        </Button>
        {map.dropSeconds !== null && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onListen(map.dropSeconds!)}
          >
            Listen from drop
          </Button>
        )}
      </div>
    </div>
  );
}

function NarrationCutSuggestions({
  script,
  disabled,
  onListen,
}: {
  script: ScriptDTO;
  disabled?: boolean;
  onListen: (seconds: number) => void;
}) {
  const [takeId, setTakeId] = React.useState("");
  const [reviewed, setReviewed] = React.useState(false);
  const cuts = useMutation({
    mutationFn: () =>
      apiPost<{
        fps: number;
        suggestions: CutSuggestion[];
        reason: string | null;
      }>(`/api/scripts/${script.id}/cut-suggestions`, {
        takeId,
        reviewed,
        expectedMusicMap: script.musicMap,
      }),
  });
  return (
    <div className="grid gap-2 border-t pt-3">
      <Label className="grid gap-1 text-xs">
        Voice take for cut review
        <select
          aria-label="Voice take for cut review"
          className="rounded border p-2"
          value={takeId}
          disabled={disabled || cuts.isPending}
          onChange={(event) => {
            setTakeId(event.target.value);
            cuts.reset();
          }}
        >
          <option value="">Choose recorded narration</option>
          {script.takes
            .filter((take) => !take.isPlaceholder)
            .map((take, index) => (
              <option key={take.id} value={take.id}>
                {take.label ?? `Take ${index + 1}`}
              </option>
            ))}
        </select>
      </Label>
      <Label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={reviewed}
          onChange={(event) => {
            setReviewed(event.target.checked);
            cuts.reset();
          }}
          disabled={disabled || cuts.isPending}
        />
        I have listened to and reviewed the saved beat map
      </Label>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || cuts.isPending || !takeId || !reviewed}
        onClick={() => cuts.mutate()}
      >
        Suggest narration-aware cuts
      </Button>
      <p className="text-muted-foreground text-xs">
        Suggestions protect measured speech and reading holds. Scene timing
        stays as edited; listen before making a manual cut.
      </p>
      {cuts.isError && (
        <p role="alert" className="text-destructive text-xs">
          {cuts.error.message}
        </p>
      )}
      {cuts.data?.reason && (
        <p className="text-muted-foreground text-xs">{cuts.data.reason}</p>
      )}
      {cuts.data?.suggestions.map((cut) => (
        <Button
          key={cut.sceneId}
          size="sm"
          variant="ghost"
          onClick={() => onListen(cut.toFrame / cuts.data!.fps)}
        >
          Scene{" "}
          {script.scenes.findIndex((scene) => scene.id === cut.sceneId) + 1}:{" "}
          {(cut.fromFrame / cuts.data!.fps).toFixed(2)}s →{" "}
          {(cut.toFrame / cuts.data!.fps).toFixed(2)}s ({cut.anchor})
        </Button>
      ))}
    </div>
  );
}
