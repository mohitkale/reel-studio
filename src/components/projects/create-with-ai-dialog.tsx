"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Lightbulb, FileText } from "lucide-react";
import { toast } from "sonner";

import type { AIProviderId } from "@/providers/ai/types";
import { useAIProviders, useGenerateProject } from "@/hooks/ai";
import {
  type Orientation,
  ORIENTATIONS,
  ORIENTATION_LABELS,
  DEFAULT_ORIENTATION,
} from "@/lib/orientation";
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
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

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
      },
      {
        onSuccess: ({ scriptId }) => {
          setOpen(false);
          setBrief("");
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create with AI</DialogTitle>
          <DialogDescription>
            Describe your video. The AI writes the script, splits it into scenes,
            and picks templates. You can edit everything afterward.
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
                <Label htmlFor="ai-scenes">Scenes</Label>
                <Combobox
                  id="ai-scenes"
                  value={sceneCount}
                  onChange={setSceneCount}
                  options={[
                    { value: "auto", label: "Auto (AI decides)" },
                    ...[4, 5, 6, 7, 8, 10, 12, 14, 16].map((n) => ({ value: String(n), label: `${n} scenes` })),
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
