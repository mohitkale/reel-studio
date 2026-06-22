"use client";

import Link from "next/link";
import { Plus, Clapperboard, Mic, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shell/page-header";

const quickStart = [
  {
    icon: Clapperboard,
    title: "Write a script",
    body: "Break your reel into scenes with text, emphasis and a template.",
  },
  {
    icon: Mic,
    title: "Generate a voice",
    body: "Pick a provider and voice, then synth a synced voiceover take.",
  },
  {
    icon: Sparkles,
    title: "Compose & render",
    body: "Add motion-design templates and render a 1080x1920 MP4.",
  },
];

export default function ProjectsPage() {
  // Projects come from the library in M3; show the empty state for now.
  const projects: { id: string; name: string }[] = [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Projects"
        description="Create and manage your short-form video projects."
        actions={
          <Button disabled>
            <Plus />
            New project
          </Button>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title="No projects yet"
          description="Projects and the editor land in milestone 3. Here is the workflow you will follow."
        />
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Quick start</h3>
          <Badge variant="secondary">3 steps</Badge>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickStart.map((step) => {
            const Icon = step.icon;
            return (
              <Card key={step.title}>
                <CardHeader>
                  <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle className="text-base">{step.title}</CardTitle>
                  <CardDescription>{step.body}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Set up your voice provider</CardTitle>
          <CardDescription>
            Add a Cartesia or ElevenLabs API key to start generating voiceovers.
            Keys stay on your machine.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/settings">Open settings</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
