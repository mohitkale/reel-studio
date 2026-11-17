"use client";

import * as React from "react";
import Link from "next/link";
import { Copy, FileJson, Loader2, Maximize } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/api-client";
import { SAMPLE_VOICES } from "@/lib/sample-voices";
import { NativeSelect } from "@/components/ui/native-select";
import { buildShareCaption, type CaptionSource } from "@/lib/share-caption";

const FORMATS = ["9:16", "16:9", "1:1"] as const;
type Storyboard = CaptionSource & { format?: string; [k: string]: unknown };

interface Made {
  format: string;
  jobId?: string | null;
  error?: string;
}

/**
 * After the video is made: copy a caption with hashtags, make the other sizes from
 * the same storyboard, or export the storyboard. All local; nothing is rewritten.
 */
export function ResultActions({
  scriptId,
  quality,
}: {
  scriptId: string;
  quality?: "draft" | "standard" | "high";
}) {
  const [busy, setBusy] = React.useState<"caption" | "sizes" | "voice">();
  const [voiceId, setVoiceId] = React.useState<string>(SAMPLE_VOICES[1].id);
  const [message, setMessage] = React.useState<string>();
  const [fallback, setFallback] = React.useState<string>();
  const [made, setMade] = React.useState<Made[]>([]);

  const load = () =>
    apiGet<{ storyboard: Storyboard }>(
      `/api/scripts/${scriptId}/storyboard`,
    ).then((r) => r.storyboard);

  async function copyCaption() {
    setBusy("caption");
    setMessage(undefined);
    setFallback(undefined);
    try {
      const { text } = buildShareCaption(await load());
      try {
        await navigator.clipboard.writeText(text);
        setMessage("Caption and hashtags copied");
      } catch {
        setFallback(text);
      }
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not build the caption",
      );
    } finally {
      setBusy(undefined);
    }
  }

  async function makeSizes() {
    setBusy("sizes");
    setMessage(undefined);
    setMade([]);
    try {
      const storyboard = await load();
      const current = storyboard.format ?? "9:16";
      const results: Made[] = [];
      for (const format of FORMATS.filter((f) => f !== current)) {
        try {
          const queued = await apiPost<{ jobId?: string | null }>(
            "/api/storyboards",
            {
              storyboard: { ...storyboard, format },
              quality: quality ?? "standard",
            },
          );
          results.push({ format, jobId: queued.jobId });
        } catch (e) {
          results.push({
            format,
            error: e instanceof Error ? e.message : "Could not start",
          });
        }
        setMade([...results]);
      }
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not load the storyboard",
      );
    } finally {
      setBusy(undefined);
    }
  }

  async function tryVoice() {
    setBusy("voice");
    setMessage(undefined);
    setMade([]);
    try {
      const storyboard = await load();
      const voice = (storyboard.voice ?? {}) as Record<string, unknown>;
      const queued = await apiPost<{ jobId?: string | null }>(
        "/api/storyboards",
        {
          storyboard: {
            ...storyboard,
            voice: { ...voice, enabled: true, voiceId },
          },
          quality: quality ?? "standard",
        },
      );
      setMade([{ format: `voice ${voiceId}`, jobId: queued.jobId }]);
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not start the new voice",
      );
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <section aria-labelledby="share-title" className="space-y-3">
      <h2 id="share-title" className="text-lg font-semibold">
        Share it
      </h2>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== undefined}
          onClick={() => void copyCaption()}
        >
          {busy === "caption" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          Copy caption and hashtags
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== undefined}
          onClick={() => void makeSizes()}
        >
          {busy === "sizes" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Maximize className="size-4" aria-hidden />
          )}
          Make other sizes
        </Button>
        <label className="flex items-center gap-2 text-sm">
          Voice
          <NativeSelect
            aria-label="Voice"
            className="w-44"
            value={voiceId}
            onChange={(event) => setVoiceId(event.target.value)}
          >
            {SAMPLE_VOICES.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.label} · {voice.detail}
              </option>
            ))}
          </NativeSelect>
        </label>
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== undefined}
          onClick={() => void tryVoice()}
        >
          {busy === "voice" && (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          )}
          Make it with this voice
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/scripts/${scriptId}/storyboard?download=1`} download>
            <FileJson className="size-4" aria-hidden /> Export storyboard JSON
          </a>
        </Button>
      </div>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {fallback && (
        <textarea
          readOnly
          aria-label="Caption and hashtags"
          value={fallback}
          rows={4}
          className="bg-background w-full rounded-lg border p-2 text-sm"
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
      {made.length > 0 && (
        <ul className="space-y-1 text-sm" aria-label="Other sizes">
          {made.map((item) => (
            <li key={item.format}>
              {item.format}:{" "}
              {item.jobId ? (
                <Link href={`/results/${item.jobId}`} className="underline">
                  watch it being made
                </Link>
              ) : (
                <span className="text-destructive">{item.error}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground text-xs">
        Other sizes and voices use the same words, so the versions match. Each
        is a separate video in your Library.
      </p>
    </section>
  );
}
