"use client";

import * as React from "react";
import { Sparkles, Loader2, RefreshCcw, Plus } from "lucide-react";
import { toast } from "sonner";

import type { SceneDTO } from "@/lib/dto";
import type { AIProviderId, ScriptStyle } from "@/providers/ai/types";
import { useAIProviders } from "@/hooks/ai";
import { useEnhanceScript } from "@/hooks/script";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MODES = [
  {
    id: "rewrite" as const,
    label: "Rewrite all scenes",
    icon: RefreshCcw,
    description: "Replace existing scenes with fresh, highly engaging AI content.",
  },
  {
    id: "append" as const,
    label: "Add more scenes",
    icon: Plus,
    description: "Generate additional scenes that continue after your existing ones.",
  },
];

export function AIEnhanceDialog({
  scriptId,
  scriptName,
  scenes,
  open,
  onOpenChange,
  onBeforeEnhance,
  onEnhanceSuccess,
}: {
  scriptId: string;
  scriptName: string;
  scenes: SceneDTO[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBeforeEnhance?: () => void;
  onEnhanceSuccess?: () => void;
}) {
  const { data: providers } = useAIProviders();
  const enhance = useEnhanceScript(scriptId);

  const [mode, setMode] = React.useState<"rewrite" | "append">("rewrite");
  const [brief, setBrief] = React.useState("");
  const [providerId, setProviderId] = React.useState<AIProviderId | undefined>();
  const [sceneCount, setSceneCount] = React.useState<string>("auto");
  const [scriptStyle, setScriptStyle] = React.useState<ScriptStyle>("short");

  const configured = (providers ?? []).filter((p) => p.configured);
  const effectiveProvider = providerId ?? configured[0]?.id;

  // Pre-fill brief from existing scenes when switching to append or on open
  React.useEffect(() => {
    if (open && !brief) {
      setBrief(scriptName !== "Untitled script" ? scriptName : "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function submit() {
    const trimmed = brief.trim();
    if (!trimmed || !effectiveProvider) return;
    onBeforeEnhance?.();
    enhance.mutate(
      {
        providerId: effectiveProvider,
        mode,
        brief: trimmed,
        sceneCount: sceneCount === "auto" ? undefined : Number(sceneCount),
        scriptStyle,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onEnhanceSuccess?.();
          toast.success(
            mode === "rewrite" ? "Scenes rewritten" : "Scenes added",
            {
              description:
                mode === "rewrite"
                  ? "All scenes replaced with new AI-generated content."
                  : "New scenes appended to your script.",
            },
          );
        },
        onError: (e) =>
          toast.error("AI generation failed", {
            description: (e as Error).message,
          }),
      },
    );
  }

  const countOptions: ComboboxOption[] =
    mode === "rewrite"
      ? [
          { value: "auto", label: "Auto (AI decides)" },
          ...["5", "6", "7", "8", "10", "12", "14", "16"].map((n) => ({ value: n, label: `${n} scenes` })),
        ]
      : [
          { value: "auto", label: "Auto (AI decides)" },
          ...["2", "3", "4", "5", "6", "8"].map((n) => ({ value: n, label: `${n} scenes` })),
        ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" />
            Generate scenes with AI
          </DialogTitle>
          <DialogDescription>
            AI will write engaging short-form scenes with a strong hook and high
            retention. Scene 1 is always a scroll-stopper.
          </DialogDescription>
        </DialogHeader>

        {configured.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No AI provider configured. Add a Gemini or OpenAI key in Settings.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {MODES.map((opt) => {
                const Icon = opt.icon;
                const active = mode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMode(opt.id)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    <span className="flex items-center gap-1.5 font-medium">
                      <Icon className="size-3.5" />
                      {opt.label}
                    </span>
                    <span className="text-xs opacity-70">{opt.description}</span>
                  </button>
                );
              })}
            </div>

            {mode === "rewrite" && scenes.length > 0 && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                All {scenes.length} existing scenes will be replaced. An <strong>Undo</strong> button will appear in the editor header so you can roll back immediately.
              </p>
            )}
            {mode === "append" && scenes.length > 0 && (
              <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                New scenes will be added after your existing {scenes.length}. An <strong>Undo</strong> button will appear so you can roll back if the result isn't right.
              </p>
            )}

            <div className="grid gap-2">
              <Label htmlFor="ai-brief">
                {mode === "rewrite" ? "What should this video be about?" : "What should the new scenes cover?"}
              </Label>
              <Textarea
                id="ai-brief"
                rows={3}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder={
                  mode === "rewrite"
                    ? "e.g. How to get started with AI in 2025"
                    : "e.g. Common mistakes and how to avoid them"
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>Script style</Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: "short" as const, label: "Short & punchy", description: "~18 words/scene, fast-paced hooks." },
                    { id: "detailed" as const, label: "Detailed", description: "~30-45 words/scene, deeper story arc." },
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
                <Label htmlFor="ai-count">Scenes</Label>
                <Combobox
                  id="ai-count"
                  value={sceneCount}
                  onChange={setSceneCount}
                  options={countOptions}
                  searchPlaceholder="Search…"
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={enhance.isPending}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!brief.trim() || !effectiveProvider || enhance.isPending}
          >
            {enhance.isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles />
                {mode === "rewrite" ? "Rewrite scenes" : "Add scenes"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
