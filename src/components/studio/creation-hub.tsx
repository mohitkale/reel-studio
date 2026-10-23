"use client";
import Link from "next/link";
import { useState } from "react";
import { Film, Mic, AudioLines, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreationWizard } from "@/components/projects/creation-wizard";
import { CreateWithAIDialog } from "@/components/projects/create-with-ai-dialog";

export function CreationHub() {
  const [kind, setKind] = useState("video");
  return (
    <section aria-labelledby="create-heading" className="space-y-4">
      <div>
        <h1
          id="create-heading"
          className="text-3xl font-semibold tracking-tight"
        >
          What will you create?
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          One idea, many outputs. Start with your content or let AI help you
          shape it.
        </p>
      </div>
      <div
        className="grid grid-cols-2 gap-2 md:grid-cols-4"
        role="group"
        aria-label="Production type"
      >
        {[
          { id: "video", label: "Video", Icon: Film },
          { id: "podcast", label: "Podcast", Icon: Mic },
          { id: "voiceover", label: "Voiceover", Icon: AudioLines },
          { id: "repurpose", label: "Repurpose", Icon: Layers },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            aria-pressed={kind === id}
            onClick={() => setKind(id)}
            className={`focus-visible:outline-ring flex min-h-20 items-center gap-3 rounded-xl border p-4 text-left focus-visible:outline-2 ${kind === id ? "border-primary bg-primary/10" : "bg-card hover:bg-muted"}`}
          >
            <Icon className="size-5 shrink-0" />
            <span className="font-medium">{label}</span>
          </button>
        ))}
      </div>
      <div className="bg-card rounded-xl border p-5">
        {kind === "video" ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-3">
              <h2 className="font-semibold">Automatic</h2>
              <p className="text-muted-foreground text-sm">
                Plan and produce from a brief, with editable results.
              </p>
              <CreateWithAIDialog
                initialQuickProduce
                trigger={<Button>Quick Produce</Button>}
              />
            </div>
            <div className="space-y-3">
              <h2 className="font-semibold">Assisted</h2>
              <p className="text-muted-foreground text-sm">
                Let AI propose a draft, then refine scenes and narration.
              </p>
              <CreateWithAIDialog
                trigger={<Button variant="outline">Create with AI</Button>}
              />
            </div>
            <div className="space-y-3">
              <h2 className="font-semibold">Manual</h2>
              <p className="text-muted-foreground text-sm">
                Arrange your script and media with local presets.
              </p>
              <CreationWizard
                trigger={<Button variant="outline">Create production</Button>}
              />
            </div>
          </div>
        ) : kind === "voiceover" ? (
          <div className="space-y-3">
            <h2 className="font-semibold">Script to voiceover</h2>
            <p className="text-muted-foreground text-sm">
              Build an audio project with paragraph takes, voice selection and
              downloadable audio.
            </p>
            <div className="flex flex-wrap gap-2">
              <CreationWizard
                initialOutputType="voiceover"
                trigger={<Button>New voiceover</Button>}
              />
              <Button asChild variant="outline">
                <Link href="/voiceovers">Open voiceover studio</Link>
              </Button>
            </div>
          </div>
        ) : kind === "podcast" ? (
          <div className="space-y-3">
            <h2 className="font-semibold">Your next episode</h2>
            <p className="text-muted-foreground text-sm">
              Write manually or generate a script, choose your cast, and produce
              an episode.
            </p>
            <Button asChild>
              <Link href="/podcasts">Open podcast studio</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="font-semibold">
              Turn a master into a series of outputs
            </h2>
            <p className="text-muted-foreground text-sm">
              Review saved masters, choose formats and cutdowns, and track
              production in the factory.
            </p>
            <Button asChild>
              <Link href="/factory">Open content factory</Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
