"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiGet, apiPost } from "@/lib/api-client";

interface ExampleSummary {
  name: string;
  title: string;
  format: string;
  theme: string;
  seconds: number;
  sceneTypes: string[];
}

type Scene = { headline?: string; narration?: string; [k: string]: unknown };
type Storyboard = { title: string; scenes: Scene[]; [k: string]: unknown };

function Remix({ name, onClose }: { name: string; onClose: () => void }) {
  const router = useRouter();
  const [storyboard, setStoryboard] = React.useState<Storyboard>();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();

  React.useEffect(() => {
    let alive = true;
    apiGet<{ storyboard: Storyboard }>(`/api/examples/${name}`)
      .then((r) => alive && setStoryboard(r.storyboard))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Could not load the example"),
      );
    return () => {
      alive = false;
    };
  }, [name]);

  const setScene = (
    i: number,
    field: "headline" | "narration",
    value: string,
  ) =>
    setStoryboard((current) =>
      current
        ? {
            ...current,
            scenes: current.scenes.map((s, j) =>
              j === i ? { ...s, [field]: value } : s,
            ),
          }
        : current,
    );

  async function make() {
    if (!storyboard) return;
    setBusy(true);
    setError(undefined);
    try {
      const queued = await apiPost<{ jobId?: string | null }>(
        "/api/storyboards",
        {
          storyboard,
          quality: "standard",
        },
      );
      if (!queued.jobId) throw new Error("The studio did not start a video");
      router.push(`/results/${queued.jobId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-3 border-t pt-4">
      {!storyboard && !error && (
        <p role="status" className="text-muted-foreground text-sm">
          Loading…
        </p>
      )}
      {storyboard && (
        <>
          <label className="block text-sm font-medium">
            Title
            <input
              value={storyboard.title}
              onChange={(e) =>
                setStoryboard({ ...storyboard, title: e.target.value })
              }
              className="bg-background mt-1 w-full rounded-lg border p-2 font-normal"
            />
          </label>
          {storyboard.scenes.map((scene, i) => (
            <fieldset key={i} className="space-y-2 rounded-lg border p-3">
              <legend className="px-1 text-xs">
                Scene {i + 1} · {String(scene.type)}
              </legend>
              <input
                aria-label={`Scene ${i + 1} headline`}
                value={scene.headline ?? ""}
                onChange={(e) => setScene(i, "headline", e.target.value)}
                className="bg-background w-full rounded-lg border p-2 text-sm font-medium"
              />
              <textarea
                aria-label={`Scene ${i + 1} narration`}
                value={scene.narration ?? ""}
                onChange={(e) => setScene(i, "narration", e.target.value)}
                rows={2}
                className="bg-background w-full rounded-lg border p-2 text-sm"
              />
            </fieldset>
          ))}
          <div className="flex gap-2">
            <Button onClick={() => void make()} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Make my version
            </Button>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

export default function ExamplesPage() {
  const router = useRouter();
  const [examples, setExamples] = React.useState<ExampleSummary[]>();
  const [open, setOpen] = React.useState<string>();
  const [busy, setBusy] = React.useState<string>();
  const [error, setError] = React.useState<string>();

  React.useEffect(() => {
    let alive = true;
    apiGet<{ examples: ExampleSummary[] }>("/api/examples")
      .then((r) => alive && setExamples(r.examples))
      .catch((e: unknown) =>
        setError(
          e instanceof Error ? e.message : "Could not load the examples",
        ),
      );
    return () => {
      alive = false;
    };
  }, []);

  async function makeAsIs(name: string) {
    setBusy(name);
    setError(undefined);
    try {
      const { storyboard } = await apiGet<{ storyboard: Storyboard }>(
        `/api/examples/${name}`,
      );
      const queued = await apiPost<{ jobId?: string | null }>(
        "/api/storyboards",
        {
          storyboard,
          quality: "standard",
        },
      );
      if (!queued.jobId) throw new Error("The studio did not start a video");
      router.push(`/results/${queued.jobId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(undefined);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Examples"
        description="Start from a finished storyboard. Change the words, keep the look, and make a video without any AI."
      />
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {!examples && !error && (
        <p role="status" className="text-muted-foreground text-sm">
          Loading examples…
        </p>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {examples?.map((example) => (
          <li key={example.name}>
            <Card className="p-4">
              <h2 className="font-semibold">{example.title}</h2>
              <p className="text-muted-foreground mt-1 text-xs">
                {example.format} · about {example.seconds} s · look:{" "}
                {example.theme}
              </p>
              <p className="text-muted-foreground mt-2 text-xs">
                Scenes: {example.sceneTypes.join(", ")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => void makeAsIs(example.name)}
                  disabled={busy === example.name}
                >
                  {busy === example.name && (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  )}
                  Make this video
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  aria-expanded={open === example.name}
                  onClick={() =>
                    setOpen(open === example.name ? undefined : example.name)
                  }
                >
                  Change the text first
                </Button>
              </div>
              {open === example.name && (
                <Remix name={example.name} onClose={() => setOpen(undefined)} />
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
