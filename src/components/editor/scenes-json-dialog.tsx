"use client";

import * as React from "react";
import { toast } from "sonner";
import { Copy, Check, Sparkles } from "lucide-react";

import type { SceneDTO, SceneBackground } from "@/lib/dto";
import { TEMPLATES, DEFAULT_TEMPLATE_ID, normalizeTemplateId } from "@/compositions/templates";
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
}

function toJson(scenes: SceneDTO[]): string {
  const payload: SceneJson[] = scenes.map((s) => ({
    templateId: normalizeTemplateId(s.templateId),
    text: s.text,
    emphasis: s.emphasis,
    visual: s.visual ?? null,
    ...(s.background ? { background: s.background } : {}),
    ...(s.items && s.items.length ? { items: s.items } : {}),
  }));
  return JSON.stringify(payload, null, 2);
}

const VALID_TEMPLATE_IDS = new Set(TEMPLATES.map((t) => t.id));
const PAN_EFFECTS = new Set(["ken-burns", "pan-left", "pan-right", "pan-up", "pan-down"]);

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
function parseScenes(raw: string): SceneJson[] {
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
      typeof s.templateId === "string" && VALID_TEMPLATE_IDS.has(s.templateId)
        ? s.templateId
        : DEFAULT_TEMPLATE_ID;
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
    return { templateId, text: s.text, emphasis, visual, background, items };
  });
}

/** A worked example covering several templates, emphasis, visual, items, background. */
const SAMPLE_JSON = `[
  {
    "templateId": "kinetic",
    "text": "Most teams ship features nobody asked for. Here is how to stop.",
    "emphasis": ["nobody asked for"],
    "visual": null
  },
  {
    "templateId": "stat-reveal",
    "text": "Up to 70% of product features are rarely or never used.",
    "emphasis": ["rarely or never used"],
    "visual": "70%"
  },
  {
    "templateId": "icon-grid",
    "text": "Validate before you build:",
    "emphasis": [],
    "visual": "✓",
    "items": ["Talk to 5 real users", "Ship a fake-door test", "Measure true intent"]
  },
  {
    "templateId": "emoji-punch",
    "text": "Build less. Learn faster.",
    "emphasis": ["Learn faster"],
    "visual": "🚀",
    "background": { "type": "image", "url": "https://images.example.com/launch.jpg", "effect": "ken-burns" }
  }
]`;

/** Self-contained prompt the user pastes into any AI tool to get compliant JSON. */
const AI_PROMPT = `You are generating a short-form vertical video storyboard as JSON for "Reel Studio".

Output ONLY a JSON array (no markdown fences, no commentary). Each array item is one scene with these fields:

- "text" (required): the spoken narration. Keep it punchy — about 18 words max.
- "templateId" (optional, default "kinetic"), one of:
  • "kinetic"     - punchy headline text reveal (the default workhorse)
  • "stat-reveal" - a big number/metric; put the number in "visual" (e.g. "73%", "10x")
  • "icon-grid"   - a checklist/tips list; set "visual" to a bullet emoji (e.g. "✓") and put rows in "items"
  • "emoji-punch" - a single big emoji punchline; put the emoji in "visual" (e.g. "🔥")
  • "quote-card"  - a quote or testimonial; "visual" is the optional attribution
  • "lottie"      - a process step / how-it-works beat
  • "three"       - one bold 3D hero moment (use at most once)
- "emphasis" (optional): array of short phrases that appear VERBATIM inside "text"; they get highlighted on screen.
- "visual" (optional): a single emoji, short stat, or label, as noted above. Use null when not applicable.
- "items" (optional): array of short strings — the rows for an "icon-grid" scene.
- "background" (optional): { "type": "image" | "video", "url": "https://…", "effect": "ken-burns" | "pan-left" | "pan-right" | "pan-up" | "pan-down" (image only), "muted": true (video only) }

Rules:
- Scene 1 MUST be a scroll-stopping hook. The final scene should end with a clear call to action.
- Vary the templates — do not make every scene "kinetic".
- Every "emphasis" phrase must match the scene's "text" exactly (same words, same case).
- 5 to 12 scenes is a good length.

Example of the exact output shape:
${SAMPLE_JSON}

Now write the JSON array for this video:
TOPIC: <describe your video idea, audience, and tone here>`;

export function ScenesJsonDialog({
  scriptId,
  scenes,
  open,
  onOpenChange,
}: {
  scriptId: string;
  scenes: SceneDTO[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
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
  onClose,
}: {
  scriptId: string;
  scenes: SceneDTO[];
  onClose: () => void;
}) {
  const importScenes = useImportScenes(scriptId);
  const [value, setValue] = React.useState(() => toJson(scenes));
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [guideOpen, setGuideOpen] = React.useState(false);

  function handleApply() {
    let parsed: SceneJson[];
    try {
      parsed = parseScenes(value);
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
        <DialogDescription>
          Edit the raw scene structure or paste your own. Applying replaces all
          scenes for this script in order. Each scene needs a <code>text</code>.
          Optional: <code>templateId</code>, <code>emphasis</code>,{" "}
          <code>visual</code>, <code>items</code> (checklist rows), and{" "}
          <code>background</code> (<code>{`{"type":"image"|"video","url":"…","effect":"ken-burns","muted":true}`}</code>).
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
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setGuideOpen(true)}>
            <Sparkles className="size-3.5" />
            Generate with AI
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
            <DialogTitle>Generate scenes with an AI tool</DialogTitle>
            <DialogDescription>
              Copy this prompt into Claude, ChatGPT, Cursor, or any AI tool, add
              your video idea at the bottom, and paste the JSON it returns back
              into the editor — then Apply. It documents every supported field,
              template, and option.
            </DialogDescription>
          </DialogHeader>

          <pre className="max-h-[22rem] overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {AI_PROMPT}
          </pre>

          <DialogFooter className="sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyText(SAMPLE_JSON, "Sample JSON")}
            >
              <Copy className="size-3.5" />
              Copy sample JSON
            </Button>
            <Button size="sm" onClick={() => copyText(AI_PROMPT, "AI prompt")}>
              <Copy className="size-3.5" />
              Copy AI prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
