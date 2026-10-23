"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useProjects } from "@/hooks/script";
import { useProviders, useVoices } from "@/hooks/voice";
import type { ProviderId } from "@/providers/voice/types";
import { apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/ui/query-error";
import type { ProductionBatchView } from "@/hooks/production-batches";

export function VoiceoverBatch() {
  const projects = useProjects(),
    providers = useProviders(),
    qc = useQueryClient();
  const [provider, setProvider] = useState<ProviderId | undefined>();
  const voices = useVoices(provider, "");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ProductionBatchView | null>(null);
  const submission = useRef<{ body: string; key: string } | null>(null);
  const eligible =
    projects.data?.filter(
      (p) => p.outputType === "voiceover" && !p.archivedAt && p.firstScriptId,
    ) ?? [];
  const entries = eligible.filter((p) => p.firstScriptId! in selected);
  const submit = useMutation({
    mutationFn: async () => {
      const rows = entries.map((p) => ({
        kind: "audio",
        scriptId: p.firstScriptId,
        providerId: provider,
        voiceId: selected[p.firstScriptId!],
        label: p.name.slice(0, 120),
      }));
      const body = JSON.stringify(rows);
      if (submission.current?.body !== body)
        submission.current = { body, key: crypto.randomUUID() };
      return apiPost<{ batch: ProductionBatchView }>(
        "/api/production-batches",
        { idempotencyKey: submission.current.key, rows, runMode: "approval" },
      );
    },
    onSuccess: ({ batch }) => {
      setResult(batch);
      void qc.invalidateQueries({ queryKey: ["production-batches"] });
      toast.success("Batch saved for review");
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <details className="bg-card rounded-xl border p-4">
      <summary className="cursor-pointer font-semibold">
        Batch voiceovers and language versions
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-muted-foreground text-sm">
          Select up to 10 saved scripts and a voice for each. For multilingual
          versions, create a script in each language and choose a matching
          voice. Review the batch in the factory before synthesis starts.
        </p>
        {projects.isError && (
          <QueryError title="Could not load scripts" retry={projects.refetch} />
        )}
        {providers.isError && (
          <QueryError
            title="Could not load providers"
            retry={providers.refetch}
          />
        )}
        <label className="grid gap-1 text-sm">
          Provider
          <select
            className="bg-background rounded border p-2"
            value={provider ?? ""}
            disabled={submit.isPending}
            onChange={(e) => {
              setProvider((e.target.value as ProviderId) || undefined);
              setSelected({});
              setResult(null);
            }}
          >
            <option value="">Choose a configured server provider</option>
            {providers.data?.providers
              .filter(
                (p) => p.configured && p.runtime !== "client" && !p.preview,
              )
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
          </select>
        </label>
        {voices.isError && (
          <QueryError title="Could not load voices" retry={voices.refetch} />
        )}
        {eligible.length === 0 && !projects.isLoading && (
          <p className="text-sm">
            Create voiceover scripts to add them to a batch.
          </p>
        )}
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {eligible.map((p) => {
            const id = p.firstScriptId!;
            const checked = id in selected;
            return (
              <div
                key={id}
                className="grid items-center gap-2 rounded border p-3 sm:grid-cols-2"
              >
                <label className="flex min-w-0 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={
                      submit.isPending ||
                      !provider ||
                      (!checked && entries.length >= 10)
                    }
                    onChange={(e) => {
                      setSelected((current) => {
                        const next = { ...current };
                        if (e.target.checked) next[id] = "";
                        else delete next[id];
                        return next;
                      });
                      setResult(null);
                    }}
                  />
                  <span className="break-words">{p.name}</span>
                </label>
                {checked && (
                  <select
                    aria-label={`Voice for ${p.name}`}
                    className="bg-background min-w-0 rounded border p-2 text-sm"
                    value={selected[id]}
                    disabled={submit.isPending || voices.isLoading}
                    onChange={(e) => {
                      setSelected((current) => ({
                        ...current,
                        [id]: e.target.value,
                      }));
                      setResult(null);
                    }}
                  >
                    <option value="">Choose voice and language</option>
                    {voices.data?.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                        {v.language ? ` · ${v.language}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-muted-foreground text-xs">
          {entries.length} scripts selected. Full narration text will be sent to
          the chosen provider after approval. Provider usage charges may apply;
          browser-only voices are generated individually.
        </p>
        <Button
          disabled={
            submit.isPending ||
            Boolean(result) ||
            !entries.length ||
            !provider ||
            entries.some(
              (p) =>
                !voices.data?.some((v) => v.id === selected[p.firstScriptId!]),
            )
          }
          onClick={() => submit.mutate()}
        >
          {submit.isPending ? "Saving batch…" : "Save batch for review"}
        </Button>
        {result && (
          <p className="text-sm" role="status">
            Batch: {result.state.replaceAll("_", " ")}.{" "}
            <Link className="underline" href="/factory">
              Review jobs and approve in the factory
            </Link>
            .
          </p>
        )}
      </div>
    </details>
  );
}
