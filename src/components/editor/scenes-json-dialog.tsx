"use client";

import * as React from "react";
import { toast } from "sonner";
import { Copy, Check, Sparkles } from "lucide-react";

import type { SceneDTO, SceneBackground } from "@/lib/dto";
import { getVideoEngine } from "@/engines/registry";
import type { VideoEngineId } from "@/engines/types";
import { useImportScenes } from "@/hooks/script";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

/** The editable shape of one scene in the JSON view (ids/order are derived). */
interface SceneJson {
  templateId: string;
  text: string;
  emphasis: string[];
  visual: string | null;
  background?: SceneBackground | null;
  items?: string[];
  mood?: string;
  musicMood?: string;
}

function toJson(scenes: SceneDTO[], videoEngine: VideoEngineId): string {
  const engine = getVideoEngine(videoEngine);
  const payload: SceneJson[] = scenes.map((s) => ({
    templateId: engine.normalizeTemplateId(s.templateId),
    text: s.text,
    emphasis: s.emphasis,
    visual: s.visual ?? null,
    ...(s.background ? { background: s.background } : {}),
    ...(s.items && s.items.length ? { items: s.items } : {}),
    ...(s.mood ? { mood: s.mood } : {}),
    ...(s.musicMood ? { musicMood: s.musicMood } : {}),
  }));
  return JSON.stringify(payload, null, 2);
}
const PAN_EFFECTS = new Set(["ken-burns", "pan-left", "pan-right", "pan-up", "pan-down"]);
const SCENE_MOODS = new Set([
  "energetic",
  "calm",
  "dramatic",
  "playful",
  "inspiring",
  "tech",
  "nature",
]);

function parseBackground(raw: unknown, sceneNum: number): SceneBackground | null {
  if (raw == null) return null;
  if (typeof raw !== "object") {
    throw new Error(`Scene ${sceneNum}: "background" must be an object or null.`);
  }
  const b = raw as Record<string, unknown>;
  if (b.type !== "image" && b.type !== "video") {
    throw new Error(`Scene ${sceneNum}: background "type" must be "image" or "video".`);
  }
  if (typeof b.url !== "string" || !b.url.trim()) {
    throw new Error(`Scene ${sceneNum}: background "url" is required.`);
  }
  const bg: SceneBackground = { type: b.type, url: b.url };
  if (b.type === "image") {
    bg.effect =
      typeof b.effect === "string" && PAN_EFFECTS.has(b.effect)
        ? (b.effect as SceneBackground["effect"])
        : "ken-burns";
  } else {
    bg.muted = b.muted === undefined ? true : Boolean(b.muted);
  }
  return bg;
}

/** Validate + normalize parsed JSON into the import payload. Throws on bad shape. */
function parseScenes(raw: string, videoEngine: VideoEngineId): SceneJson[] {
  const engine = getVideoEngine(videoEngine);
  const validIds = new Set(engine.listTemplates().map((t) => t.id));
  const defaultId = engine.defaultTemplateId;
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error("Top-level value must be an array of scenes.");
  }
  return data.map((item, i) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`Scene ${i + 1}: must be an object.`);
    }
    const s = item as Record<string, unknown>;
    if (typeof s.text !== "string") {
      throw new Error(`Scene ${i + 1}: "text" is required and must be a string.`);
    }
    const templateId =
      typeof s.templateId === "string" && validIds.has(s.templateId)
        ? s.templateId
        : defaultId;
    let emphasis: string[] = [];
    if (Array.isArray(s.emphasis)) {
      emphasis = s.emphasis.filter((e): e is string => typeof e === "string");
    } else if (s.emphasis != null) {
      throw new Error(`Scene ${i + 1}: "emphasis" must be an array of strings.`);
    }
    const visual =
      typeof s.visual === "string" && s.visual.trim() ? s.visual : null;
    const background = parseBackground(s.background, i + 1);
    let items: string[] | undefined;
    if (Array.isArray(s.items)) {
      items = s.items.filter((e): e is string => typeof e === "string").map((e) => e.trim()).filter(Boolean);
      if (!items.length) items = undefined;
    } else if (s.items != null) {
      throw new Error(`Scene ${i + 1}: "items" must be an array of strings.`);
    }
    let mood: string | undefined;
    if (typeof s.mood === "string" && SCENE_MOODS.has(s.mood)) {
      mood = s.mood;
    } else if (s.mood != null) {
      throw new Error(
        `Scene ${i + 1}: "mood" must be one of ${Array.from(SCENE_MOODS).join(", ")}.`,
      );
    }
    let musicMood: string | undefined;
    if (typeof s.musicMood === "string" && s.musicMood.trim()) {
      musicMood = s.musicMood.trim().slice(0, 60);
    } else if (s.musicMood != null) {
      throw new Error(`Scene ${i + 1}: "musicMood" must be a string.`);
    }
    return { templateId, text: s.text, emphasis, visual, background, items, mood, musicMood };
  });
}

/** A worked example: hook → proof → list → punch → CTA. */
const SAMPLE_JSON = `[
  {
    "templateId": "kinetic",
    "text": "Stop posting every day. Your audience is tired of noise.",
    "emphasis": ["Stop posting every day"],
    "visual": null,
    "mood": "dramatic",
    "musicMood": "tense cinematic"
  },
  {
    "templateId": "stat-reveal",
    "text": "Accounts that post three strong clips a week grow 2x faster than daily posters.",
    "emphasis": ["2x faster"],
    "visual": "2x",
    "mood": "tech"
  },
  {
    "templateId": "icon-grid",
    "text": "Do this instead:",
    "emphasis": [],
    "visual": "✓",
    "items": ["One hook people finish", "One proof they believe", "One clear next step"],
    "mood": "energetic"
  },
  {
    "templateId": "emoji-punch",
    "text": "Quality beats calendar spam. Every time.",
    "emphasis": ["Quality beats"],
    "visual": "🔥",
    "mood": "playful",
    "musicMood": "uplifting lo-fi"
  },
  {
    "templateId": "quote-card",
    "text": "Ship fewer videos. Make each one impossible to scroll past.",
    "emphasis": [],
    "visual": "— Your future self",
    "mood": "inspiring",
    "musicMood": "warm acoustic"
  }
]`;

/**
 * Scene-array prompt for any external AI. Style + Energy are set in the Reel
 * Studio editor (not in this JSON) so import stays backward compatible.
 */
const AI_PROMPT = `You are generating a short-form vertical video storyboard as JSON for "Reel Studio".

Output ONLY a JSON array (no markdown fences, no commentary). Each array item is one scene.

FIELD GUIDE (plain English):
- "text" (required): words spoken by the voiceover. About 18 words max. No markdown.
- "templateId" (optional, default "kinetic") — the on-screen layout:
  • "kinetic"     - big headline text (use sparingly)
  • "stat-reveal" - giant number; put the number in "visual" (e.g. "73%", "10x")
  • "icon-grid"   - ONLY for 3–5 SHORT tips (max ~8 words each). Put rows in "items"; short header in "text"; "visual" = "✓". Never use for one long sentence.
  • "emoji-punch" - big emoji reaction; put emoji in "visual"
  • "quote-card"  - quote/testimonial; "visual" = optional attribution
  • "lottie"      - process / how-it-works beat
  • "three"       - one bold 3D hero moment (use at most once)
- "emphasis" (optional): short phrases copied EXACTLY from "text" to highlight on screen
- "visual" (optional): emoji, stat, or label as above; use null when not needed
- "items" (optional): checklist rows for "icon-grid"
- "background" (optional): { "type": "image"|"video", "url": "https://…", "effect": "ken-burns"|"pan-left"|"pan-right"|"pan-up"|"pan-down", "muted": true }
- "mood" (optional): energetic|calm|dramatic|playful|inspiring|tech|nature — animated background when there is no photo
- "musicMood" (optional): 1–3 words for music vibe (e.g. "uplifting lo-fi")

STORY RULES:
- Scene 1 MUST be a scroll-stopping hook (bold claim, surprising number, "stop doing X", or tense question).
- Shape: Hook → Problem/Insight → Proof or List → Punch → CTA (last scene).
- Never use the same templateId twice in a row. Prefer at least 4 different templates in 5+ scenes.
- Every "emphasis" phrase must appear verbatim inside that scene's "text".
- 5 to 12 scenes is a good length.
- Scenes without a photo need a "mood".

NOTE: Do NOT put styleId or energy in this JSON. In Reel Studio, Style (Bold Hook / Clean Story / Teach Me / Soft Brand) and Energy (Calm / Normal / High) are chosen in the editor toolbar and apply to the whole video.

Example of the exact output shape:
${SAMPLE_JSON}

Now write the JSON array for this video:
TOPIC: <replace with your video idea, audience, and tone>`;

/** Longer guide users can copy when they want Style/Energy recommendations too. */
const FULL_STORYBOARD_PROMPT = `You are a short-form video director helping me plan a Reel Studio video.

1) Recommend ONE Style for the whole video:
   - bold-hook — big text, strong pops (tips, launches)
   - clean-story — calmer, premium brand story
   - teach-me — explainers, lists, stats
   - soft-brand — lifestyle / wellness / soft motion
   And ONE Energy: calm | normal | high

2) Then output ONLY a JSON array of scenes (no markdown fences) following this schema and example:

${AI_PROMPT}

At the top of your reply (before the JSON), write one line like:
STYLE: bold-hook | ENERGY: normal
I will set Style/Energy in the Reel Studio editor myself; paste only the JSON array into Scenes as JSON.`;

export function ScenesJsonDialog({
  scriptId,
  scenes,
  open,
  onOpenChange,
  videoEngine = "remotion",
}: {
  scriptId: string;
  scenes: SceneDTO[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  videoEngine?: VideoEngineId;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {/* Remounted per open so the editor always initializes from the latest
            scenes without a resync effect. */}
        {open && (
          <JsonEditorBody
            scriptId={scriptId}
            scenes={scenes}
            videoEngine={videoEngine}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function JsonEditorBody({
  scriptId,
  scenes,
  videoEngine,
  onClose,
}: {
  scriptId: string;
  scenes: SceneDTO[];
  videoEngine: VideoEngineId;
  onClose: () => void;
}) {
  const importScenes = useImportScenes(scriptId);
  const [value, setValue] = React.useState(() => toJson(scenes, videoEngine));
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [guideOpen, setGuideOpen] = React.useState(false);

  function handleApply() {
    let parsed: SceneJson[];
    try {
      parsed = parseScenes(value, videoEngine);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON.");
      return;
    }
    if (parsed.length === 0) {
      setError("Provide at least one scene.");
      return;
    }
    setError(null);
    importScenes.mutate(parsed, {
      onSuccess: () => {
        toast.success(`Imported ${parsed.length} scene${parsed.length === 1 ? "" : "s"}`);
        onClose();
      },
      onError: () => toast.error("Failed to import scenes"),
    });
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Scenes as JSON</DialogTitle>
        <DialogDescription asChild>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Edit or paste a JSON <strong className="text-foreground">array of scenes</strong>.
              Apply replaces all scenes for this script. Each scene needs{" "}
              <code className="text-xs">text</code> (the spoken line).
            </p>
            <p className="text-xs">
              Optional fields: layout (<code className="text-xs">templateId</code>),
              highlights (<code className="text-xs">emphasis</code>),{" "}
              <code className="text-xs">visual</code>, checklist{" "}
              <code className="text-xs">items</code>, photo/video{" "}
              <code className="text-xs">background</code>,{" "}
              <code className="text-xs">mood</code>,{" "}
              <code className="text-xs">musicMood</code>.{" "}
              <strong className="text-foreground">Style</strong> and{" "}
              <strong className="text-foreground">Energy</strong> are set in the
              editor toolbar — not in this JSON.
            </p>
          </div>
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <textarea
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          spellCheck={false}
          className="h-80 w-full resize-none rounded-lg border bg-muted/30 p-3 font-mono text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder='[ { "templateId": "kinetic", "text": "...", "emphasis": [], "visual": null } ]'
        />
        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>

      <DialogFooter className="sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy JSON"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setValue(SAMPLE_JSON);
              setError(null);
              toast.success("Sample loaded", {
                description: "Review it, then Apply scenes — or edit the topic first.",
              });
            }}
          >
            Load sample
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setGuideOpen(true)}>
            <Sparkles className="size-3.5" />
            AI prompt help
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleApply} disabled={importScenes.isPending}>
            {importScenes.isPending ? "Applying..." : "Apply scenes"}
          </Button>
        </div>
      </DialogFooter>

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Generate scenes with any AI tool</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  1) Copy a prompt below into ChatGPT, Claude, Cursor, etc.
                </p>
                <p>
                  2) Replace <code className="text-xs">TOPIC:</code> with your idea.
                </p>
                <p>
                  3) Paste only the JSON array back here and click{" "}
                  <strong className="text-foreground">Apply scenes</strong>.
                </p>
                <p className="text-xs">
                  Tip: set Style + Energy in the editor after import so the whole
                  reel looks consistent.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">
              Scenes-only prompt (paste result into this dialog)
            </p>
            <pre className="max-h-[14rem] overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
              {AI_PROMPT}
            </pre>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">
              Full storyboard prompt (also recommends Style + Energy)
            </p>
            <pre className="max-h-[10rem] overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
              {FULL_STORYBOARD_PROMPT}
            </pre>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyText(SAMPLE_JSON, "Sample JSON")}
              >
                <Copy className="size-3.5" />
                Copy sample JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyText(FULL_STORYBOARD_PROMPT, "Full storyboard prompt")}
              >
                <Copy className="size-3.5" />
                Copy full prompt
              </Button>
            </div>
            <Button size="sm" onClick={() => copyText(AI_PROMPT, "AI scenes prompt")}>
              <Copy className="size-3.5" />
              Copy scenes prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
