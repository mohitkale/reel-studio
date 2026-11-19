"use client";

import * as React from "react";
import Link from "next/link";
import { Copy, FileJson, Loader2, Maximize, Scissors } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/api-client";
import { SAMPLE_VOICES } from "@/lib/sample-voices";
import { NativeSelect } from "@/components/ui/native-select";
import { buildShareCaption, type CaptionSource } from "@/lib/share-caption";
import { buildShareText } from "@/lib/share-text";
import { useAIProviders } from "@/hooks/ai";
import { pickWriter } from "@/lib/writer-chain";
import { VOICE_STYLES, VOICE_STYLE_IDS } from "@/lib/voice-styles";
import { KOKORO_LANGUAGE_GROUPS } from "@/providers/voice/kokoro";

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
  const [busy, setBusy] = React.useState<
    "caption" | "share" | "sizes" | "voice" | "shorts" | "language"
  >();
  const providers = useAIProviders();
  const [style, setStyle] = React.useState<string>("");
  const [language, setLanguage] = React.useState<string>("es");
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

  async function copyShareText() {
    setBusy("share");
    setMessage(undefined);
    setFallback(undefined);
    try {
      const text = buildShareText((await load()).title);
      try {
        await navigator.clipboard.writeText(text);
        setMessage("Share text copied");
      } catch {
        setFallback(text);
      }
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not build the share text",
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

  async function makeShorts() {
    setBusy("shorts");
    setMessage(undefined);
    setMade([]);
    try {
      const result = await apiPost<{
        shorts: Array<{
          title: string;
          seconds: number;
          jobId?: string | null;
        }>;
      }>(`/api/scripts/${scriptId}/cutdowns`, {
        quality: quality ?? "standard",
      });
      setMade(
        result.shorts.map((short) => ({
          format: `${short.title} (${short.seconds} s)`,
          jobId: short.jobId,
        })),
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not make the shorts");
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
            voice: {
              ...voice,
              enabled: true,
              voiceId,
              ...(style ? { style } : {}),
            },
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

  /** The same video in another language: the writer translates, the scenes stay. */
  async function makeLanguage() {
    setBusy("language");
    setMessage(undefined);
    setMade([]);
    try {
      const writer = pickWriter(providers.data);
      if (!writer)
        throw new Error(
          "A language version needs a writer to translate the words. Set one up in Settings.",
        );
      const label =
        KOKORO_LANGUAGE_GROUPS.find((group) => group.id === language)?.label ??
        language;
      const storyboard = await load();
      const written = await apiPost<{
        storyboard?: Record<string, unknown>;
        errors?: Array<{ path: string; message: string }>;
      }>("/api/storyboards/write", {
        providerId: writer.id,
        research: "off",
        fromSourceText: true,
        brief: {
          topic: "Translate this video",
          revise: {
            storyboard,
            instruction: `Translate the narration and every on-screen text into ${label} and set language to "${language}". Keep the scene types, their order, the numbers and the structure exactly as they are.`,
          },
        },
      });
      if (!written.storyboard)
        throw new Error(
          written.errors?.map((e) => e.message).join("; ") ||
            "The writer did not return a translation.",
        );
      const queued = await apiPost<{ jobId?: string | null }>(
        "/api/storyboards",
        {
          storyboard: written.storyboard,
          quality: quality ?? "standard",
        },
      );
      setMade([{ format: label, jobId: queued.jobId }]);
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not make the language version",
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
          onClick={() => void copyShareText()}
        >
          {busy === "share" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
          Copy share text
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
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== undefined}
          onClick={() => void makeShorts()}
        >
          {busy === "shorts" ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Scissors className="size-4" aria-hidden />
          )}
          Make shorts from this
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
        <label className="flex items-center gap-2 text-sm">
          Style
          <NativeSelect
            aria-label="Voice style"
            className="w-36"
            value={style}
            onChange={(event) => setStyle(event.target.value)}
          >
            <option value="">Natural</option>
            {VOICE_STYLE_IDS.map((id) => (
              <option key={id} value={id} title={VOICE_STYLES[id].description}>
                {VOICE_STYLES[id].label}
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
        <label className="flex items-center gap-2 text-sm">
          Language
          <NativeSelect
            aria-label="Language"
            className="w-44"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            {KOKORO_LANGUAGE_GROUPS.map((group) => (
              <option key={group.id} value={group.id}>
                {group.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== undefined}
          onClick={() => void makeLanguage()}
        >
          {busy === "language" && (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          )}
          Make it in this language
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
