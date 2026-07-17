"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Lightbulb, FileText } from "lucide-react";
import { toast } from "sonner";

import type { AIProviderId, ScriptStyle } from "@/providers/ai/types";
import { useAIProviders, useGenerateProject } from "@/hooks/ai";
import {
  type Orientation,
  ORIENTATIONS,
  ORIENTATION_LABELS,
  DEFAULT_ORIENTATION,
} from "@/lib/orientation";
import {
  DEFAULT_VIDEO_ENGINE,
  VIDEO_ENGINE_DESCRIPTIONS,
  VIDEO_ENGINE_IDS,
  VIDEO_ENGINE_LABELS,
  type VideoEngineId,
} from "@/engines/types";
import {
  StyleEnergyControls,
  type EnergyPick,
  type StylePick,
} from "@/components/visual/style-energy-controls";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

const EXAMPLE_BRIEFS = [
  "3 mistakes new founders make in their first year",
  "Why your mornings feel chaotic (and the 2-minute fix)",
  "One CapCut habit that doubles watch time on Reels",
  "Stop posting every day — do this weekly instead",
];

export function CreateWithAIDialog() {
  const router = useRouter();
  const { data: providers } = useAIProviders();
  const generate = useGenerateProject();

  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"idea" | "story">("idea");
  const [brief, setBrief] = React.useState("");
  const [providerId, setProviderId] = React.useState<AIProviderId | undefined>();
  const [sceneCount, setSceneCount] = React.useState<string>("auto");
  const [orientation, setOrientation] =
    React.useState<Orientation>(DEFAULT_ORIENTATION);
  const [scriptStyle, setScriptStyle] = React.useState<ScriptStyle>("short");
  const [videoEngine, setVideoEngine] =
    React.useState<VideoEngineId>(DEFAULT_VIDEO_ENGINE);
  const [styleId, setStyleId] = React.useState<StylePick>("bold-hook");
  const [energy, setEnergy] = React.useState<EnergyPick>("normal");

  const configured = (providers ?? []).filter((p) => p.configured);
  const effectiveProvider = providerId ?? configured[0]?.id;

  function submit() {
    const trimmed = brief.trim();
    if (!trimmed || !effectiveProvider) return;
    generate.mutate(
      {
        providerId: effectiveProvider,
        mode,
        brief: trimmed,
        sceneCount: sceneCount === "auto" ? undefined : Number(sceneCount),
        orientation,
        scriptStyle,
        videoEngine,
        styleId,
        energy,
      },
      {
        onSuccess: ({ scriptId }) => {
          setOpen(false);
          setBrief("");
          setVideoEngine(DEFAULT_VIDEO_ENGINE);
          setStyleId("bold-hook");
          setEnergy("normal");
          toast.success("Video drafted", {
            description: "Review and tweak the scenes in the editor.",
          });
          router.push(`/editor/${scriptId}`);
        },
        onError: (e) =>
          toast.error("Generation failed", {
            description: (e as Error).message,
          }),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Sparkles />
          Create with AI
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create with AI</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Describe your video. AI writes a hook-first script, splits it into
                scenes, picks layouts, and applies your default brand kit.
              </p>
              <p className="text-xs">
                You&apos;ll get: a scroll-stopping first scene, mixed templates
                (stats, lists, punchlines), your Style + Energy look, and everything
                editable afterward.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        {configured.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No AI provider configured. Add a Gemini or OpenAI key in{" "}
            <Link href="/settings" className="text-primary underline">
              Settings
            </Link>{" "}
            to use this, or create a project manually.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: "idea", label: "Quick idea", icon: Lightbulb },
                  { id: "story", label: "Paste a story", icon: FileText },
                ] as const
              ).map((opt) => {
                const Icon = opt.icon;
                const active = mode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMode(opt.id)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    <Icon className="size-4" />
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ai-brief">
                {mode === "idea" ? "Your idea" : "Your story or script"}
              </Label>
              <Textarea
                id="ai-brief"
                rows={mode === "idea" ? 3 : 6}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder={
                  mode === "idea"
                    ? "e.g. 3 quick tips for writing better prompts"
                    : "Paste the full story or script you want turned into a reel..."
                }
              />
              {mode === "idea" ? (
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLE_BRIEFS.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setBrief(example)}
                      className="rounded-full border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <StyleEnergyControls
              styleId={styleId}
              energy={energy}
              onStyleChange={setStyleId}
              onEnergyChange={setEnergy}
              allowAuto
              compact
            />

            <div className="grid gap-2">
              <Label>Script style</Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    {
                      id: "short" as const,
                      label: "Short & punchy",
                      description: "~18 words/scene, fast-paced hooks.",
                    },
                    {
                      id: "detailed" as const,
                      label: "Detailed",
                      description: "~30-45 words/scene, deeper story arc.",
                    },
                  ]
                ).map((opt) => {
                  const active = scriptStyle === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setScriptStyle(opt.id)}
                      className={cn(
                        "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "text-muted-foreground hover:bg-accent",
                      )}
                    >
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-xs opacity-70">{opt.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Video engine</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {VIDEO_ENGINE_IDS.map((id) => {
                  const selected = videoEngine === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setVideoEngine(id)}
                      className={cn(
                        "rounded-lg border p-3 text-left text-sm transition-colors",
                        selected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "text-muted-foreground hover:bg-accent",
                      )}
                    >
                      <div className="font-medium">{VIDEO_ENGINE_LABELS[id]}</div>
                      <p className="mt-1 text-xs opacity-80">
                        {VIDEO_ENGINE_DESCRIPTIONS[id]}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ai-orientation">Orientation</Label>
              <Combobox
                id="ai-orientation"
                value={orientation}
                onChange={(v) => setOrientation(v as Orientation)}
                options={ORIENTATIONS.map((o) => ({
                  value: o,
                  label: ORIENTATION_LABELS[o],
                }))}
                searchPlaceholder="Search…"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="ai-provider">Provider</Label>
                <Combobox
                  id="ai-provider"
                  value={effectiveProvider ?? ""}
                  onChange={(v) => setProviderId(v as AIProviderId)}
                  options={configured.map((p) => ({ value: p.id, label: p.label }))}
                  placeholder="Select provider…"
                  searchPlaceholder="Search providers…"
                />
              </div>
              <div className="grid gap-2">
                <HintTooltip label="How many scenes the AI should write. Auto usually picks 5–10." side="top">
                  <Label htmlFor="ai-scenes">Scenes</Label>
                </HintTooltip>
                <Combobox
                  id="ai-scenes"
                  value={sceneCount}
                  onChange={setSceneCount}
                  options={[
                    { value: "auto", label: "Auto (AI decides)" },
                    ...[4, 5, 6, 7, 8, 10, 12, 14, 16].map((n) => ({
                      value: String(n),
                      label: `${n} scenes`,
                    })),
                  ]}
                  searchPlaceholder="Search…"
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button
            onClick={submit}
            disabled={
              !brief.trim() || !effectiveProvider || generate.isPending
            }
          >
            {generate.isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles />
                Generate video
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
