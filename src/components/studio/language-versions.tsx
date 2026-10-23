"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api-client";
import { useAIProviders } from "@/hooks/ai";
import { Button } from "@/components/ui/button";
import { GenerationSummary } from "./generation-summary";
import type { AIProviderId } from "@/providers/ai/types";
type Paragraph = { sceneId: string; text: string; spokenText: string };
type Source = { sourceHash: string; paragraphs: Paragraph[] };
export function LanguageVersions({ scriptId }: { scriptId: string }) {
  const [open, setOpen] = useState(false),
    [source, setSource] = useState<Source | null>(null),
    [error, setError] = useState("");
  async function load() {
    setSource(null);
    setError("");
    try {
      setSource(
        await apiGet<Source>(`/api/scripts/${scriptId}/language-versions`),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load source");
    }
  }
  return (
    <details
      className="bg-card rounded-xl border p-4"
      onToggle={(e) => {
        setOpen(e.currentTarget.open);
        if (e.currentTarget.open) void load();
      }}
    >
      <summary className="cursor-pointer font-semibold">
        Create a language version
      </summary>
      {open &&
        (source ? (
          <TranslationEditor
            key={source.sourceHash}
            scriptId={scriptId}
            source={source}
          />
        ) : (
          <p role={error ? "alert" : "status"}>
            {error || "Loading source…"}
            {error && (
              <Button variant="outline" onClick={() => void load()}>
                Retry
              </Button>
            )}
          </p>
        ))}
    </details>
  );
}
function TranslationEditor({
  scriptId,
  source,
}: {
  scriptId: string;
  source: Source;
}) {
  const [language, setLanguage] = useState(""),
    [provider, setProvider] = useState<AIProviderId | undefined>(),
    [paragraphs, setParagraphs] = useState<Paragraph[]>(
      source.paragraphs.map((p) => ({ ...p, text: "", spokenText: "" })),
    ),
    [busy, setBusy] = useState(false);
  const providers = useAIProviders(),
    router = useRouter(),
    qc = useQueryClient();
  async function preview() {
    if (!provider) return;
    setBusy(true);
    try {
      const result = await apiPost<{
        sourceHash: string;
        paragraphs: Paragraph[];
      }>(`/api/scripts/${scriptId}/language-versions`, {
        action: "preview",
        language,
        providerId: provider,
      });
      if (result.sourceHash !== source.sourceHash)
        throw new Error(
          "Source changed. Close and reopen language versions before translating again.",
        );
      setParagraphs(result.paragraphs);
      toast.info(
        "Review the translation, especially names and factual claims, before saving.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Translation failed");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    try {
      const result = await apiPost<{ scriptId: string; outputType: string }>(
        `/api/scripts/${scriptId}/language-versions`,
        { action: "save", language, sourceHash: source.sourceHash, paragraphs },
      );
      await qc.invalidateQueries({ queryKey: ["projects"] });
      router.push(
        `/${result.outputType === "voiceover" ? "voiceovers" : "editor"}/${result.scriptId}`,
      );
      toast.success("Language version saved as a separate project");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save version");
    } finally {
      setBusy(false);
    }
  }
  return (
    <fieldset disabled={busy} className="mt-3 space-y-3">
      <p className="text-muted-foreground text-sm">
        Paste a translation for a free manual workflow, or preview one with an
        AI provider you choose. Saving creates a separate project and preserves
        the source.
      </p>
      <label className="grid gap-1 text-sm">
        Target language
        <input
          className="bg-background rounded border p-2"
          maxLength={64}
          placeholder="For example, Hindi"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Optional AI provider
        <select
          className="bg-background rounded border p-2"
          value={provider ?? ""}
          onChange={(e) =>
            setProvider(
              (e.target.value || undefined) as AIProviderId | undefined,
            )
          }
        >
          <option value="">Manual translation — no API call</option>
          {providers.data
            ?.filter((p) => p.configured)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
        </select>
      </label>
      {provider && (
        <>
          <GenerationSummary
            providerId={provider}
            text={source.paragraphs
              .map((p) => p.text + "\n" + p.spokenText)
              .join("\n")}
            scope="Translation preview"
          />
          <Button
            disabled={language.trim().length < 2}
            onClick={() => void preview()}
          >
            Preview AI translation
          </Button>
        </>
      )}
      <div className="max-h-[32rem] space-y-3 overflow-y-auto">
        {paragraphs.map((p, i) => (
          <article key={p.sceneId} className="space-y-2 rounded border p-3">
            <p className="text-muted-foreground text-xs whitespace-pre-wrap">
              Source {i + 1}: {source.paragraphs[i].spokenText}
            </p>
            {(["text", "spokenText"] as const).map((field) => (
              <label key={field} className="grid gap-1 text-sm">
                {field === "text"
                  ? "Translated on-screen copy"
                  : "Translated voice script"}
                <textarea
                  className="bg-background min-h-20 rounded border p-2"
                  maxLength={field === "text" ? 2000 : 4000}
                  value={p[field]}
                  onChange={(e) =>
                    setParagraphs((current) =>
                      current.map((item, index) =>
                        index === i
                          ? { ...item, [field]: e.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </label>
            ))}
          </article>
        ))}
      </div>
      <Button
        disabled={
          language.trim().length < 2 ||
          paragraphs.some((p) => !p.text.trim() || !p.spokenText.trim())
        }
        onClick={() => void save()}
      >
        {busy ? "Working…" : "Save language version"}
      </Button>
    </fieldset>
  );
}
