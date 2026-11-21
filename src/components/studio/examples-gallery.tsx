"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAIProviders } from "@/hooks/ai";
import { useReviewFields } from "@/hooks/ui-mode";
import type { ExampleSummary } from "@/library/examples";
import { apiGet, apiPost } from "@/lib/api-client";
import { pickWriter, writerPrivacyNote } from "@/lib/writer-chain";
import type { VideoStoryboard } from "@/storyboard";

import { ExamplePreview } from "./example-previews";

function Remix({
  example,
  onClose,
}: {
  example: ExampleSummary;
  onClose: () => void;
}) {
  const router = useRouter();
  const review = useReviewFields();
  const providers = useAIProviders();
  const writer = pickWriter(providers.data);
  const [storyboard, setStoryboard] = React.useState<VideoStoryboard>();
  const [topic, setTopic] = React.useState("");
  const [busy, setBusy] = React.useState<"writing" | "making">();
  const [error, setError] = React.useState<string>();

  React.useEffect(() => {
    let alive = true;
    apiGet<{ storyboard: VideoStoryboard }>(`/api/examples/${example.name}`)
      .then((r) => alive && setStoryboard(r.storyboard))
      .catch((e: unknown) => {
        if (alive)
          setError(
            e instanceof Error ? e.message : "Could not load the example",
          );
      });
    return () => {
      alive = false;
    };
  }, [example.name]);

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
    if (!storyboard || busy) return;
    setBusy("making");
    setError(undefined);
    try {
      const queued = await apiPost<{ jobId?: string | null }>(
        "/api/storyboards",
        {
          storyboard,
          quality: "standard",
          ...review,
        },
      );
      if (!queued.jobId) throw new Error("The studio did not start a video");
      router.push(`/results/${queued.jobId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(undefined);
    }
  }

  async function rewrite() {
    const nextTopic = topic.trim();
    if (!storyboard || !writer || !nextTopic || busy) return;
    setBusy("writing");
    setError(undefined);
    try {
      const { storyboard: written } = await apiPost<{
        storyboard?: VideoStoryboard | null;
      }>("/api/storyboards/write", {
        providerId: writer.id,
        brief: {
          topic: nextTopic,
          kind: "video",
          format: storyboard.format,
          targetSeconds: Math.max(5, example.seconds),
          revise: {
            storyboard,
            instruction: `New topic: ${nextTopic}. Rewrite the copy and scene details. Keep the number and order of scenes and each scene type. Use only sources for the new topic.`,
          },
        },
        research: "off",
        retry: false,
      });
      if (
        written?.kind !== "video" ||
        written.scenes.length !== storyboard.scenes.length ||
        written.scenes.some(
          (scene, index) => scene.type !== storyboard.scenes[index].type,
        )
      ) {
        throw new Error(
          "The writer could not keep the example’s scene structure. Try another topic or edit the words below.",
        );
      }
      setStoryboard({
        ...storyboard,
        title: written.title,
        scenes: written.scenes.map((scene, index) => {
          const original = storyboard.scenes[index];
          return {
            ...scene,
            pace: original.pace,
            durationHint: original.durationHint,
            presenter: original.presenter,
          };
        }),
        sources: written.sources,
        publish: written.publish,
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not rewrite the example",
      );
    } finally {
      setBusy(undefined);
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
          {writer && (
            <div className="space-y-2 border-b pb-3">
              <label className="block text-sm font-medium">
                New topic
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  maxLength={300}
                  disabled={Boolean(busy)}
                  placeholder="What should this video be about?"
                  className="bg-background mt-1 w-full rounded-lg border p-2 font-normal"
                />
              </label>
              <p className="text-muted-foreground text-xs">
                {writer.kind === "cloud"
                  ? `The topic and example storyboard are sent to ${writer.label}.`
                  : writerPrivacyNote(writer)}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void rewrite()}
                disabled={Boolean(busy) || !topic.trim()}
              >
                {busy === "writing" && (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                )}
                Rewrite for this topic
              </Button>
            </div>
          )}
          <label className="block text-sm font-medium">
            Title
            <input
              value={storyboard.title}
              disabled={Boolean(busy)}
              onChange={(e) =>
                setStoryboard({ ...storyboard, title: e.target.value })
              }
              className="bg-background mt-1 w-full rounded-lg border p-2 font-normal"
            />
          </label>
          {storyboard.scenes.map((scene, i) => (
            <fieldset
              key={i}
              disabled={Boolean(busy)}
              className="space-y-2 rounded-lg border p-3"
            >
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
            <Button onClick={() => void make()} disabled={Boolean(busy)}>
              {busy === "making" && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
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

export function ExamplesGallery({
  examples,
  initialOpen,
}: {
  examples: ExampleSummary[];
  initialOpen?: string;
}) {
  const router = useRouter();
  const review = useReviewFields();
  const [open, setOpen] = React.useState(initialOpen);
  const [busy, setBusy] = React.useState<string>();
  const [error, setError] = React.useState<string>();

  async function makeAsIs(name: string) {
    setBusy(name);
    setError(undefined);
    try {
      const { storyboard } = await apiGet<{ storyboard: VideoStoryboard }>(
        `/api/examples/${name}`,
      );
      const queued = await apiPost<{ jobId?: string | null }>(
        "/api/storyboards",
        {
          storyboard,
          quality: "standard",
          ...review,
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
      {examples.length === 0 && (
        <p className="text-muted-foreground text-sm">
          The bundled examples are unavailable.
        </p>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {examples.map((example) => (
          <li
            key={example.name}
            id={`example-${example.name}`}
            className="scroll-mt-16"
          >
            <Card className="space-y-3 p-4">
              <h2 className="font-semibold">{example.title}</h2>
              <ExamplePreview name={example.name} title={example.title} />
              <p className="text-muted-foreground text-xs">
                {example.format} · about {example.seconds} s · look:{" "}
                {example.theme}
              </p>
              <p className="text-muted-foreground text-xs">
                Scenes: {example.sceneTypes.join(", ")}
              </p>
              <div className="flex flex-wrap gap-2">
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
                <Remix example={example} onClose={() => setOpen(undefined)} />
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
