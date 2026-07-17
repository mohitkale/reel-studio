"use client";

import * as React from "react";
import {
  Trash2,
  ChevronUp,
  ChevronDown,
  ImagePlus,
  Loader2,
  Plus,
  X,
  GripVertical,
  AlertTriangle,
} from "lucide-react";

import type { SceneDTO, SceneBackground } from "@/lib/dto";
import { getVideoEngine } from "@/engines/registry";
import type { VideoEngineId } from "@/engines/types";
import { useAssets, useUploadAsset } from "@/hooks/assets";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AssetThumbPicker } from "@/components/assets/asset-thumb-picker";

const VISUAL_HINTS: Record<string, string> = {
  "stat-reveal": "Key stat or number (e.g. 73% or 10x)",
  "icon-grid": "Bullet emoji (e.g. ✓ or →)",
  "quote-card": "Author or attribution (optional)",
  "hf-stat": "Key stat or number (e.g. 73% or 10x)",
  "hf-list": "Bullet emoji (e.g. ✓ or →)",
  "hf-quote": "Author or attribution (optional)",
  "hf-cta": "CTA label (e.g. Follow for more)",
  "emoji-punch": "A single emoji (e.g. 🔥 or ⚡)",
  kinetic: "Optional emoji shown in the kicker",
  lottie: "Optional emoji shown above the animation",
  three: "Optional emoji shown in the caption area",
};

const PAN_EFFECTS = [
  { value: "ken-burns", label: "Ken Burns zoom" },
  { value: "pan-left", label: "Pan left" },
  { value: "pan-right", label: "Pan right" },
  { value: "pan-up", label: "Pan up" },
  { value: "pan-down", label: "Pan down" },
];

type BackgroundKind = "none" | "image" | "video";

function backgroundKind(bg: SceneBackground | undefined): BackgroundKind {
  return bg?.type ?? "none";
}

type UpdateVars = {
  id: string;
  text?: string;
  templateId?: string;
  emphasis?: string[];
  visual?: string | null;
  background?: SceneBackground | null;
  items?: string[] | null;
  hideText?: boolean | null;
};

/**
 * Probes a video URL in the browser and warns if it can't be loaded — the most
 * common cause is a source that blocks hotlinking (Pixabay, many stock sites) or
 * is missing CORS, in which case it won't play in the preview or the render.
 */
function VideoUrlStatus({ url }: { url: string }) {
  const [result, setResult] = React.useState<{ url: string; ok: boolean } | null>(
    null,
  );
  const status = result?.url === url ? (result.ok ? "ok" : "error") : "checking";

  React.useEffect(() => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "metadata";
    const ok = () => setResult({ url, ok: true });
    const fail = () => setResult({ url, ok: false });
    video.addEventListener("loadeddata", ok);
    video.addEventListener("canplay", ok);
    video.addEventListener("error", fail);
    video.src = trimmed;
    video.load();
    return () => {
      video.removeEventListener("loadeddata", ok);
      video.removeEventListener("canplay", ok);
      video.removeEventListener("error", fail);
      video.removeAttribute("src");
      video.load();
    };
  }, [url]);

  if (status !== "error") return null;
  return (
    <div className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>
        This video couldn&apos;t be loaded, so the scene falls back to the brand
        background. Many sites (Pixabay, stock sites) block direct links — download
        the file and use the upload button, or use a direct, public{" "}
        <code>.mp4</code> URL.
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Background editor — image or video, applicable to any template      */
/* ------------------------------------------------------------------ */

function BackgroundEditor({
  background,
  onChange,
}: {
  background: SceneBackground | undefined;
  onChange: (bg: SceneBackground | null) => void;
}) {
  // Kind + draft fields are local UI state (initialized from the scene; the
  // parent SceneInspector is keyed by scene.id so this remounts per scene). We
  // only commit a background once it actually has a URL — committing an empty
  // URL would fail server validation (causing a flicker/revert) and crash the
  // video layer with "No src passed".
  const [kind, setKind] = React.useState<BackgroundKind>(backgroundKind(background));
  const [url, setUrl] = React.useState(background?.url ?? "");
  const [effect, setEffect] = React.useState<NonNullable<SceneBackground["effect"]>>(
    background?.effect ?? "ken-burns",
  );
  const [muted, setMuted] = React.useState(background?.muted ?? true);

  const assetType = kind === "video" ? "video" : "image";
  const { data: assets } = useAssets(kind === "none" ? undefined : assetType);
  const uploadAsset = useUploadAsset();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function commit(next: { kind: BackgroundKind; url: string; effect: typeof effect; muted: boolean }) {
    if (next.kind === "none" || !next.url.trim()) {
      onChange(null);
      return;
    }
    onChange(
      next.kind === "image"
        ? { type: "image", url: next.url.trim(), effect: next.effect }
        : { type: "video", url: next.url.trim(), muted: next.muted },
    );
  }

  function changeKind(next: BackgroundKind) {
    setKind(next);
    // Carry the URL over only if it already belonged to this kind.
    const carried = background?.type === next ? (background?.url ?? "") : "";
    setUrl(carried);
    commit({ kind: next, url: carried, effect, muted });
  }

  function changeUrl(next: string) {
    setUrl(next);
    commit({ kind, url: next, effect, muted });
  }

  function changeEffect(next: typeof effect) {
    setEffect(next);
    commit({ kind, url, effect: next, muted });
  }

  function changeMuted(next: boolean) {
    setMuted(next);
    commit({ kind, url, effect, muted: next });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", assetType);
    try {
      const asset = await uploadAsset.mutateAsync(fd);
      changeUrl(asset.url);
    } catch {
      /* surfaced by the mutation */
    }
  }

  return (
    <div className="grid gap-2 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <Label>Background</Label>
        <div className="flex rounded-md border p-0.5">
          {(["none", "image", "video"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => changeKind(k)}
              className={cn(
                "rounded px-2 py-0.5 text-xs capitalize transition-colors",
                kind === k
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {kind !== "none" && (
        <>
          <div className="flex gap-2">
            <Input
              placeholder={kind === "video" ? "Video URL…" : "Image URL…"}
              value={url}
              onChange={(e) => changeUrl(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={uploadAsset.isPending}
              onClick={() => fileInputRef.current?.click()}
              aria-label={`Upload ${kind}`}
            >
              {uploadAsset.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ImagePlus className="size-3.5" />
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={kind === "video" ? "video/*" : "image/*"}
              className="hidden"
              onChange={handleUpload}
            />
          </div>

          {assets && assets.length > 0 && (
            <AssetThumbPicker
              assets={assets}
              selectedUrl={url}
              kind={kind}
              onSelect={changeUrl}
              aspect="video"
            />
          )}

          {kind === "image" && (
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Animation effect</Label>
              <Combobox
                value={effect}
                onChange={(v) => changeEffect(v as typeof effect)}
                options={PAN_EFFECTS}
                searchPlaceholder="Search effects…"
              />
            </div>
          )}

          {kind === "video" && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={muted}
                  onChange={(e) => changeMuted(e.target.checked)}
                  className="size-4 rounded border-border"
                />
                Mute video audio track
              </label>
              {url.trim() ? <VideoUrlStatus url={url} /> : null}
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Checklist items editor — for the icon-grid template                 */
/* ------------------------------------------------------------------ */

function ChecklistEditor({
  items,
  onChange,
}: {
  items: string[];
  onChange: (items: string[]) => void;
}) {
  // Initialized once per mount; SceneInspector is keyed by scene.id, so switching
  // scenes remounts this with the right items — no resync effect needed.
  const [draft, setDraft] = React.useState<string[]>(items.length ? items : [""]);

  function commit(next: string[]) {
    setDraft(next);
    onChange(next.map((s) => s.trim()).filter(Boolean));
  }

  function setItem(i: number, value: string) {
    const next = [...draft];
    next[i] = value;
    setDraft(next); // commit on blur to avoid thrashing the player
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= draft.length) return;
    const next = [...draft];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  }

  return (
    <div className="grid gap-2">
      <Label>Checklist items</Label>
      <p className="text-xs text-muted-foreground">
        Each item becomes its own row with an icon badge. Leave empty to fall back
        to splitting the scene text.
      </p>
      <div className="grid gap-1.5">
        {draft.map((item, i) => (
          <div key={i} className="flex items-center gap-1">
            <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
            <Input
              value={item}
              placeholder={`Item ${i + 1}`}
              onChange={(e) => setItem(i, e.target.value)}
              onBlur={() => commit(draft)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit([...draft.slice(0, i + 1), "", ...draft.slice(i + 1)]);
                }
              }}
            />
            <div className="flex shrink-0">
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                aria-label="Move item up"
              >
                <ChevronUp className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                disabled={i === draft.length - 1}
                onClick={() => move(i, 1)}
                aria-label="Move item down"
              >
                <ChevronDown className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-7 text-muted-foreground hover:text-destructive"
                onClick={() => commit(draft.filter((_, idx) => idx !== i))}
                aria-label="Remove item"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Button
        size="sm"
        variant="outline"
        className="justify-start"
        onClick={() => commit([...draft, ""])}
      >
        <Plus className="size-3.5" />
        Add item
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scene inspector                                                     */
/* ------------------------------------------------------------------ */

/**
 * Edits one scene. Mount with key={scene.id} so local draft state resets when a
 * different scene is selected. Text/emphasis/visual commit on blur; template,
 * background and checklist items commit on change.
 */
export function SceneInspector({
  scene,
  sceneIndex,
  totalScenes,
  onNavigate,
  onUpdate,
  onDelete,
  saving,
  videoEngine = "remotion",
}: {
  scene: SceneDTO;
  sceneIndex: number;
  totalScenes: number;
  onNavigate: (direction: -1 | 1) => void;
  onUpdate: (vars: UpdateVars) => void;
  onDelete: (id: string) => void;
  saving?: boolean;
  videoEngine?: VideoEngineId;
}) {
  const [text, setText] = React.useState(scene.text);
  const [emphasis, setEmphasis] = React.useState(scene.emphasis.join(", "));
  const [visual, setVisual] = React.useState(scene.visual ?? "");
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const engine = getVideoEngine(videoEngine);
  const templates = engine.listTemplates();
  const normalId = engine.normalizeTemplateId(scene.templateId);
  const isChecklist = normalId === "icon-grid" || normalId === "hf-list";

  function commitText() {
    if (text !== scene.text) onUpdate({ id: scene.id, text });
  }

  function commitEmphasis() {
    const parsed = emphasis
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parsed.join("|") !== scene.emphasis.join("|")) {
      onUpdate({ id: scene.id, emphasis: parsed });
    }
  }

  function commitVisual() {
    const val = visual.trim() || null;
    if (val !== (scene.visual ?? null)) {
      onUpdate({ id: scene.id, visual: val });
    }
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header with scene navigation */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold">Scene</h3>
            {saving && <span className="text-xs text-muted-foreground">Saving...</span>}
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              disabled={sceneIndex === 0}
              onClick={() => onNavigate(-1)}
              aria-label="Previous scene"
            >
              <ChevronUp className="size-3.5" />
            </Button>
            <span className="w-14 text-center text-xs text-muted-foreground tabular-nums">
              {sceneIndex + 1} / {totalScenes}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              disabled={sceneIndex === totalScenes - 1}
              onClick={() => onNavigate(1)}
              aria-label="Next scene"
            >
              <ChevronDown className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="scene-text">Text</Label>
          <Textarea
            id="scene-text"
            value={text}
            rows={4}
            placeholder="What is said in this scene"
            onChange={(e) => setText(e.target.value)}
            onBlur={commitText}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="scene-template">Template</Label>
          <Combobox
            id="scene-template"
            value={normalId}
            onChange={(v) => onUpdate({ id: scene.id, templateId: v })}
            options={templates.map((t) => ({ value: t.id, label: t.name }))}
            searchPlaceholder="Search templates…"
          />
          <p className="text-xs text-muted-foreground">
            {templates.find((t) => t.id === normalId)?.description}
          </p>
        </div>

        {isChecklist && (
          <ChecklistEditor
            items={scene.items ?? []}
            onChange={(items) =>
              onUpdate({ id: scene.id, items: items.length ? items : null })
            }
          />
        )}

        {/* Background (image/video) — available for every template */}
        <BackgroundEditor
          background={scene.background}
          onChange={(bg) => onUpdate({ id: scene.id, background: bg })}
        />

        {/* Per-scene on-screen text override (wins over the global Text toggle). */}
        <div className="grid gap-1.5">
          <Label>Text on screen</Label>
          <div className="flex rounded-md border p-0.5">
            {(
              [
                ["Default", null],
                ["Show", false],
                ["Hide", true],
              ] as const
            ).map(([label, val]) => {
              const selected = (scene.hideText ?? null) === val;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => onUpdate({ id: scene.id, hideText: val })}
                  className={cn(
                    "flex-1 rounded px-2 py-0.5 text-xs transition-colors",
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            “Default” follows the global Text toggle; Show/Hide overrides it for
            this scene. Hiding shows just the background.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="scene-visual">Visual</Label>
          <Input
            id="scene-visual"
            value={visual}
            placeholder={VISUAL_HINTS[normalId] ?? "Emoji, icon, or label"}
            onChange={(e) => setVisual(e.target.value)}
            onBlur={commitVisual}
          />
          <p className="text-xs text-muted-foreground">
            {VISUAL_HINTS[normalId] ?? "Optional visual element for this scene."}
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="scene-emphasis">Emphasis (comma separated)</Label>
          <Input
            id="scene-emphasis"
            value={emphasis}
            placeholder="key phrase, another phrase"
            onChange={(e) => setEmphasis(e.target.value)}
            onBlur={commitEmphasis}
          />
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 />
          Delete scene
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete scene?"
        description={
          scene.text
            ? `"${scene.text.slice(0, 60)}${scene.text.length > 60 ? "…" : ""}" will be permanently removed.`
            : "This scene will be permanently removed."
        }
        onConfirm={() => {
          onDelete(scene.id);
          setConfirmOpen(false);
        }}
      />
    </>
  );
}
