"use client";

import * as React from "react";
import {
  CircleAlert,
  CircleCheck,
  Copy,
  Download,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api-client";
import {
  buildPublishingKit,
  checkPlatforms,
  type KitSource,
  type PublishingKit as Kit,
} from "@/lib/publishing-kit";
import { buildZip } from "@/lib/zip";

type Storyboard = Omit<KitSource, "chapters"> & {
  chapters?: { title: string; startScene: number }[];
  [k: string]: unknown;
};

/**
 * What a person needs to post the video (roadmap A6): a title, a description and
 * hashtags with copy buttons, whether each fits YouTube, Shorts, Reels, TikTok
 * and LinkedIn, and one zip with the text, captions and the storyboard.
 * Built from the storyboard's own words; nothing is rewritten by an AI.
 */
export function PublishingKit({
  scriptId,
  jobId,
  hasCaptions,
  sceneStarts,
}: {
  /** Seconds at which each scene starts in the finished video, in scene order. */
  sceneStarts?: number[];
  scriptId: string;
  /** The finished video's job; the thumbnails use a frame from its MP4. */
  jobId: string;
  hasCaptions: boolean;
}) {
  const [kit, setKit] = React.useState<Kit>();
  const [storyboard, setStoryboard] = React.useState<Storyboard>();
  const [error, setError] = React.useState<string>();
  const [copied, setCopied] = React.useState<string>();
  const [fallback, setFallback] = React.useState<string>();
  const [zipping, setZipping] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    apiGet<{ storyboard: Storyboard }>(`/api/scripts/${scriptId}/storyboard`)
      .then(({ storyboard }) => {
        if (!alive) return;
        setStoryboard(storyboard);
        setKit(
          buildPublishingKit({
            ...storyboard,
            chapters: storyboard.chapters?.flatMap((chapter) => {
              const at = sceneStarts?.[chapter.startScene];
              return at === undefined
                ? []
                : [{ title: chapter.title, startSeconds: at }];
            }),
          }),
        );
      })
      .catch(
        (e: unknown) =>
          alive &&
          setError(e instanceof Error ? e.message : "Could not build the kit"),
      );
    return () => {
      alive = false;
    };
  }, [scriptId, sceneStarts]);

  async function copy(label: string, text: string) {
    setFallback(undefined);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
    } catch {
      setFallback(text);
    }
  }

  async function downloadZip() {
    if (!kit || !storyboard) return;
    setZipping(true);
    setError(undefined);
    try {
      const encoder = new TextEncoder();
      const files = [
        { name: "title.txt", data: encoder.encode(`${kit.title}\n`) },
        {
          name: "description.txt",
          data: encoder.encode(`${kit.description}\n`),
        },
        { name: "hashtags.txt", data: encoder.encode(`${kit.hashtagLine}\n`) },
        {
          name: "storyboard.json",
          data: encoder.encode(`${JSON.stringify(storyboard, null, 2)}\n`),
        },
      ];
      if (hasCaptions) {
        for (const format of ["srt", "vtt"] as const) {
          const response = await fetch(
            `/api/scripts/${scriptId}/captions?format=${format}`,
          );
          if (response.ok)
            files.push({
              name: `captions.${format}`,
              data: new Uint8Array(await response.arrayBuffer()),
            });
        }
      }
      // A thumbnail needs Chrome; the zip is still useful without it.
      try {
        const thumbnail = await fetch(
          `/api/production-jobs/${jobId}/thumbnail?size=landscape`,
        );
        if (thumbnail.ok)
          files.push({
            name: "thumbnail-1280x720.png",
            data: new Uint8Array(await thumbnail.arrayBuffer()),
          });
      } catch {
        // Leave the thumbnail out.
      }
      const blob = new Blob([buildZip(files) as BlobPart], {
        type: "application/zip",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "publishing-kit.zip";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not make the zip");
    } finally {
      setZipping(false);
    }
  }

  if (error && !kit)
    return (
      <p role="alert" className="text-destructive text-sm">
        {error}
      </p>
    );
  if (!kit) return null;
  const fits = checkPlatforms(kit);

  return (
    <section aria-labelledby="kit-title" className="space-y-3">
      <h2 id="kit-title" className="text-lg font-semibold">
        Publishing kit
      </h2>
      <dl className="space-y-3 text-sm">
        {(
          [
            ["Title", kit.title],
            ["Description", kit.description],
            ["Hashtags", kit.hashtagLine],
          ] as const
        ).map(([label, text]) => (
          <div key={label} className="space-y-1">
            <dt className="flex items-center gap-2 font-medium">
              {label}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void copy(label, text)}
                aria-label={`Copy ${label.toLowerCase()}`}
              >
                <Copy className="size-3.5" aria-hidden />
                {copied === label ? "Copied" : "Copy"}
              </Button>
            </dt>
            <dd className="bg-muted/40 rounded-md border p-2 whitespace-pre-wrap">
              {text}
            </dd>
          </div>
        ))}
      </dl>
      {fallback && (
        <textarea
          readOnly
          aria-label="Text to copy"
          value={fallback}
          rows={4}
          className="bg-background w-full rounded-lg border p-2 text-sm"
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
      <ul
        className="grid gap-1 text-sm sm:grid-cols-2"
        aria-label="Fit on each platform"
      >
        {fits.map((fit) => (
          <li key={fit.id} className="flex items-start gap-2">
            {fit.ok ? (
              <CircleCheck
                className="text-success mt-0.5 size-4 shrink-0"
                aria-label="fits"
              />
            ) : (
              <CircleAlert
                className="text-warning mt-0.5 size-4 shrink-0"
                aria-label="too long"
              />
            )}
            <span>
              {fit.label}
              {fit.problems.length > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  · {fit.problems.join("; ")}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={zipping}
          onClick={() => void downloadZip()}
        >
          {zipping ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
          Download the kit (zip)
        </Button>
        {error && (
          <span role="alert" className="text-destructive text-sm">
            {error}
          </span>
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        The thumbnail puts the thumbnail text over a frame of the video, in the
        theme&apos;s colours. The zip holds the title, description, hashtags,
        storyboard, the 1280×720 thumbnail
        {hasCaptions ? " and captions (SRT and VTT)" : ""}. Platform limits
        change; check the platform before relying on them. The video itself is
        the MP4 above.
      </p>
    </section>
  );
}
