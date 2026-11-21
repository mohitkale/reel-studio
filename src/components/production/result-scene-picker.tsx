"use client";

import * as React from "react";
import { AssetThumbPicker } from "@/components/assets/asset-thumb-picker";
import { HyperFramesPlayer } from "@/components/editor/hyperframes-player";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { sceneLibrary } from "@/engines/hyperframes/scenes/library";
import { useAssets } from "@/hooks/assets";
import type { SceneBackground, SceneDTO } from "@/lib/dto";

const previews = [
  ...new Map(
    sceneLibrary()
      .filter((entry) => entry.type !== "code")
      .map((entry) => [entry.templateId, entry]),
  ).values(),
];

export function ResultScenePicker({
  mode,
  scene,
  disabled,
  onClose,
  onTemplate,
  onMedia,
}: {
  mode: "type" | "media";
  scene: SceneDTO;
  disabled: boolean;
  onClose(): void;
  onTemplate(id: string): void;
  onMedia(background: SceneBackground | null): void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        {mode === "type" ? (
          <SceneTypePicker
            scene={scene}
            disabled={disabled}
            onApply={onTemplate}
          />
        ) : (
          <SceneMediaPicker
            scene={scene}
            disabled={disabled}
            onApply={onMedia}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SceneTypePicker({
  scene,
  disabled,
  onApply,
}: {
  scene: SceneDTO;
  disabled: boolean;
  onApply(id: string): void;
}) {
  // Data-dependent layouts stay in the full editor unless this scene already
  // has their content. Sample numbers and text never enter the user's video.
  const choices = previews.filter((entry) => {
    if (entry.templateId === scene.templateId) return true;
    if (entry.scene.panel) return false;
    return (
      (!entry.scene.chart || !!scene.chart) &&
      (!entry.scene.items || !!scene.items?.length) &&
      (entry.type !== "media" || !!scene.background)
    );
  });
  const [id, select] = React.useState(
    choices.find((entry) => entry.templateId === scene.templateId)
      ?.templateId ?? choices[0].templateId,
  );
  const entry = choices.find((choice) => choice.templateId === id)!;
  return (
    <>
      <DialogTitle>Choose a scene type</DialogTitle>
      <DialogDescription>
        Preview the layout with sample content.
      </DialogDescription>
      <NativeSelect
        aria-label="Scene type"
        value={id}
        onChange={(event) => select(event.target.value)}
      >
        {choices.map((choice) => (
          <option key={choice.templateId} value={choice.templateId}>
            {choice.name}
          </option>
        ))}
      </NativeSelect>
      <div className="mx-auto aspect-video w-full max-w-xs overflow-hidden rounded-md border">
        <HyperFramesPlayer
          key={id}
          scenes={[entry.scene]}
          timeline={[
            { sceneId: entry.scene.id, startFrame: 0, durationFrames: 90 },
          ]}
          fps={30}
          totalFrames={90}
          width={640}
          height={360}
          previewQuality="draft"
          loop
        />
      </div>
      <p className="text-muted-foreground text-sm">{entry.description}</p>
      <Button
        disabled={disabled || id === scene.templateId}
        onClick={() => onApply(id)}
      >
        Use this scene type
      </Button>
    </>
  );
}

function SceneMediaPicker({
  scene,
  disabled,
  onApply,
}: {
  scene: SceneDTO;
  disabled: boolean;
  onApply(background: SceneBackground | null): void;
}) {
  const [kind, setKind] = React.useState(scene.background?.type ?? "image");
  const { data, isLoading, isError } = useAssets(kind);
  return (
    <>
      <DialogTitle>Choose scene media</DialogTitle>
      <DialogDescription>
        Pick an image or video from your library.
      </DialogDescription>
      <NativeSelect
        aria-label="Media type"
        value={kind}
        onChange={(event) =>
          setKind(event.target.value === "video" ? "video" : "image")
        }
      >
        <option value="image">Images</option>
        <option value="video">Videos</option>
      </NativeSelect>
      <fieldset disabled={disabled}>
        {data?.length ? (
          <AssetThumbPicker
            assets={data}
            kind={kind}
            selectedUrl={scene.background?.url}
            onSelect={(url) =>
              onApply(
                kind === "video"
                  ? { type: kind, url, muted: true }
                  : { type: kind, url, effect: "ken-burns" },
              )
            }
          />
        ) : (
          <p role="status" className="text-muted-foreground text-sm">
            {isLoading
              ? "Loading media…"
              : isError
                ? "Could not open your media library."
                : "No media of this type in your library."}
          </p>
        )}
      </fieldset>
      {scene.background && (
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => onApply(null)}
        >
          Remove scene media
        </Button>
      )}
    </>
  );
}
