"use client";
import { useMemo, useState } from "react";
import { defaultBrandTokens } from "@/video/tokens";
import {
  applyVisualTheme,
  VISUAL_THEMES,
} from "@/production/creative-direction";
import {
  ADAPTIVE_RECIPES,
  isAdaptiveRecipe,
  type AdaptiveRecipeId,
} from "@/video/adaptive-catalog";
import { ADAPTIVE_SAMPLES } from "@/video/adaptive-samples";
import { resolveAdaptiveLayout } from "@/production/adaptive-layout";
import { MOTION_SYSTEMS, type MotionSystem } from "@/production/motion-systems";
import type { MotionDirection } from "@/production/motion";
import type { ReelScene } from "@/video/types";
import type { BrandTokens } from "@/video/tokens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { HyperFramesPlayer } from "./hyperframes-player";

export function AdaptiveRecipeCatalog({
  scene,
  tokens,
  onSelect,
}: {
  scene?: ReelScene;
  tokens?: BrandTokens;
  onSelect?: (motion: MotionDirection) => void;
}) {
  const [selected, setSelected] = useState<AdaptiveRecipeId>(
    isAdaptiveRecipe(scene?.motion?.recipeId)
      ? scene.motion.recipeId
      : "adaptive-concept",
  );
  const [query, setQuery] = useState("");
  const [system, setSystem] = useState<MotionSystem>(
    scene?.motion?.system ?? "precision",
  );
  const [format, setFormat] = useState("portrait");
  const [seconds, setSeconds] = useState(8);
  const [width, height] =
    format === "portrait"
      ? [1080, 1920]
      : format === "landscape"
        ? [1920, 1080]
        : [1080, 1080];
  const choices = useMemo(
    () =>
      ADAPTIVE_RECIPES.map((recipe, index) => {
        const input = {
          ...(scene ?? ADAPTIVE_SAMPLES[index]),
          motion: { recipeId: recipe.id, version: "1.0.0" as const, system },
        };
        return {
          recipe,
          input,
          ...resolveAdaptiveLayout(input, width, height, seconds),
        };
      }),
    [scene, width, height, seconds, system],
  );
  const active = choices.find((c) => c.recipe.id === selected)!;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Find a recipe
          <Input
            aria-label="Find adaptive recipe"
            placeholder="Compare, process, evidence…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="text-sm">
          Format
          <select
            aria-label="Adaptive preview format"
            className="bg-background block rounded border p-2"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          >
            {["portrait", "landscape", "square"].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Visual family
          <select
            aria-label="Adaptive visual family"
            className="bg-background block rounded border p-2"
            value={system}
            onChange={(e) => setSystem(e.target.value as MotionSystem)}
          >
            {MOTION_SYSTEMS.map((s) => (
              <option value={s.id} key={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Preview seconds
          <input
            aria-label="Adaptive preview seconds"
            className="bg-background block w-20 rounded border p-2"
            type="number"
            min={1}
            max={120}
            value={seconds}
            onChange={(e) =>
              setSeconds(
                Math.max(1, Math.min(120, Number(e.target.value) || 1)),
              )
            }
          />
        </label>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          {choices
            .filter((c) =>
              `${c.recipe.name} ${c.recipe.description} ${c.recipe.intent}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((c) => (
              <button
                key={c.recipe.id}
                type="button"
                aria-pressed={selected === c.recipe.id}
                onClick={() => setSelected(c.recipe.id)}
                className={`w-full rounded-lg border p-3 text-left ${selected === c.recipe.id ? "border-primary bg-muted" : "border-border"}`}
              >
                <strong className="text-sm">{c.recipe.name}</strong>
                <p className="text-muted-foreground mt-1 text-xs">
                  {c.reason ?? c.plan?.reason}
                </p>
              </button>
            ))}
          {onSelect && (
            <Button
              disabled={!active.plan || scene?.locks?.scene}
              onClick={() => onSelect(active.input.motion)}
            >
              Use this recipe
            </Button>
          )}
          <p className="text-muted-foreground text-xs">
            {scene
              ? "Preview uses your saved copy and inputs. Applying changes only the treatment and visual family; preview format and seconds do not change the video."
              : "Illustrative copy and data. Choose a recipe to explore its layout and pacing."}
            {scene?.locks?.scene
              ? " Unlock the scene before changing its recipe."
              : ""}
          </p>
        </div>
        <div className="space-y-3">
          {active.plan ? (
            <HyperFramesPlayer
              key={`${selected}-${format}-${seconds}-${system}`}
              scenes={[active.input]}
              timeline={[
                {
                  sceneId: active.input.id,
                  startFrame: 0,
                  durationFrames: seconds * 30,
                },
              ]}
              totalFrames={seconds * 30}
              fps={30}
              width={width}
              height={height}
              tokens={
                tokens ??
                applyVisualTheme(
                  defaultBrandTokens,
                  system === "editorial"
                    ? VISUAL_THEMES.paper
                    : system === "poster"
                      ? VISUAL_THEMES.signal
                      : VISUAL_THEMES.circuit,
                )
              }
              loop
            />
          ) : (
            <p className="bg-muted rounded-lg p-6 text-sm">
              {active.reason} Your current design is preserved.
            </p>
          )}
          <p className="text-muted-foreground text-sm">
            {active.recipe.description}
          </p>
          {active.plan?.warnings.map((w) => (
            <p key={w} className="text-sm">
              {w}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
export function AdaptiveRecipePicker(props: {
  scene: ReelScene;
  tokens?: BrandTokens;
  onSelect: (motion: MotionDirection) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Adaptive recipes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Find a recipe for this scene</DialogTitle>
          <DialogDescription>
            Preview the complete saved content before applying a versioned
            treatment.
          </DialogDescription>
        </DialogHeader>
        <AdaptiveRecipeCatalog
          {...props}
          onSelect={(motion) => {
            props.onSelect(motion);
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
