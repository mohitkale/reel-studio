"use client";

import * as React from "react";
import { toast } from "sonner";
import { useEditSfxCue, useScript } from "@/hooks/script";
import { parseSfxState } from "@/lib/sfx-cues";
import { SFX_LIBRARY, type SfxCue } from "@/lib/sfx-library";
import type { SfxCueEditRequest } from "@/lib/sfx-cue-edit";
import type { SceneDTO } from "@/lib/dto";
import { resolveMotionDirection } from "@/production/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

function CueRow({
  cue,
  index,
  scene,
  hideText,
  busy,
  save,
}: {
  cue: SfxCue;
  index: number;
  scene?: SceneDTO;
  hideText: boolean;
  busy: boolean;
  save: (input: SfxCueEditRequest) => Promise<unknown>;
}) {
  const id = React.useId();
  const [sound, setSound] = React.useState(cue.sfxId);
  const [level, setLevel] = React.useState(
    String(Number((cue.volume * 100).toFixed(4))),
  );
  const [timing, setTiming] = React.useState(String(cue.offsetSeconds));
  const volume = Number(level) / 100;
  const offsetSeconds = Number(timing);
  const valid =
    level.trim() !== "" &&
    timing.trim() !== "" &&
    Number.isFinite(volume) &&
    volume >= 0 &&
    volume <= 1 &&
    Number.isFinite(offsetSeconds) &&
    offsetSeconds >= (cue.event ? -2 : 0) &&
    offsetSeconds <= (cue.event ? 2 : 120);
  const dirty =
    sound !== cue.sfxId ||
    Math.abs(volume - cue.volume) > 0.00001 ||
    offsetSeconds !== cue.offsetSeconds;
  const motion =
    scene &&
    resolveMotionDirection(
      scene.motion,
      scene.text,
      scene.chart,
      Boolean(scene.visual),
      scene.items,
      scene.background,
    );
  const stale =
    cue.event &&
    (!motion ||
      motion.recipeId !== cue.event.recipeId ||
      motion.version !== cue.event.version ||
      (scene?.hideText ?? hideText));
  const preserved = cue.source !== "automatic" || cue.locked;

  return (
    <div className="grid gap-2 rounded-md border p-2.5">
      <p className="text-xs font-medium">
        {scene
          ? `Scene ${scene.order + 1} · ${scene.text.slice(0, 65)}`
          : "Deleted scene"}
      </p>
      <p className="text-muted-foreground text-xs">
        {preserved ? "Edited cue · kept on refresh" : "Automatic cue"}
        {cue.volume === 0 ? " · muted" : ""}
      </p>
      {stale && (
        <p className="text-xs text-amber-600">
          Motion changed or text is hidden. This cue is silent; use automatic to
          update it.
        </p>
      )}
      <Label htmlFor={`${id}-sound`} className="text-xs">
        Sound
      </Label>
      <NativeSelect
        id={`${id}-sound`}
        value={sound}
        disabled={busy}
        onChange={(event) => setSound(event.target.value as SfxCue["sfxId"])}
      >
        {SFX_LIBRARY.map((clip) => (
          <option key={clip.id} value={clip.id}>
            {clip.name}
          </option>
        ))}
      </NativeSelect>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1">
          <Label htmlFor={`${id}-level`} className="text-xs">
            Level (%) · 0 mutes
          </Label>
          <Input
            id={`${id}-level`}
            type="number"
            min={0}
            max={100}
            step={1}
            value={level}
            disabled={busy}
            onChange={(event) => setLevel(event.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`${id}-timing`} className="text-xs">
            {cue.event
              ? `Shift from ${cue.event.anchor} (s)`
              : "After scene start (s)"}
          </Label>
          <Input
            id={`${id}-timing`}
            type="number"
            min={cue.event ? -2 : 0}
            max={cue.event ? 2 : 120}
            step={0.01}
            value={timing}
            disabled={busy}
            onChange={(event) => setTiming(event.target.value)}
          />
        </div>
      </div>
      <p className="text-muted-foreground text-[11px]">
        {cue.event
          ? "Negative shifts play earlier; positive shifts play later. Up to two seconds either way."
          : "Timing is measured from this scene’s start."}
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={busy || !valid || !dirty}
          onClick={() =>
            void save({
              index,
              expected: cue,
              action: "edit",
              changes: { sfxId: sound, volume, offsetSeconds },
            })
          }
        >
          Save cue
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() =>
            void save({ index, expected: cue, action: "automatic" })
          }
        >
          Use automatic
        </Button>
      </div>
    </div>
  );
}

export function SfxCueEditor({
  scriptId,
  disabled = false,
}: {
  scriptId: string;
  disabled?: boolean;
}) {
  const { data: script } = useScript(scriptId);
  const edit = useEditSfxCue(scriptId);
  if (!script) return null;
  const { cues } = parseSfxState(script.sfxJson);
  if (!cues.length) return null;
  async function save(input: SfxCueEditRequest) {
    try {
      await edit.mutateAsync(input);
      toast.success(
        input.action === "edit"
          ? "Sound cue saved"
          : "Automatic sound restored",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save sound cue",
      );
    }
  }
  return (
    <details className="text-sm">
      <summary className="cursor-pointer py-1">
        Adjust sound cues · {cues.length} saved
      </summary>
      <p className="text-muted-foreground py-2 text-xs">
        Choose a sound, mute it, or shift its timing. Saved edits stay in place
        when you refresh. Quiet scenes, tightly spaced accents, and automatic
        clips that do not fit a scene stay silent.
      </p>
      <div className="grid max-h-80 gap-2 overflow-y-auto">
        {cues.map((cue, index) => (
          <CueRow
            key={`${index}:${JSON.stringify(cue)}`}
            cue={cue}
            index={index}
            scene={script.scenes.find((scene) => scene.id === cue.sceneId)}
            hideText={script.hideText}
            busy={disabled || edit.isPending}
            save={save}
          />
        ))}
      </div>
    </details>
  );
}
