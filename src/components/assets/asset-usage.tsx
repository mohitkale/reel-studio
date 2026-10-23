"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import { QueryError } from "@/components/ui/query-error";
export function AssetUsage({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["asset-usage", id],
    enabled: open,
    queryFn: () =>
      apiGet<{
        scenes: Array<{ id: string; scriptId: string; label: string }>;
        scripts: Array<{ id: string; name: string }>;
        podcasts: Array<{ id: string; title: string }>;
        frozen: Array<{ kind: string; id: string; label: string }>;
        frozenCount: number;
        provenance: Record<string, unknown> | null;
      }>(`/api/assets/${id}/usage`),
  });
  const data = query.data;
  return (
    <details
      className="mt-2 text-xs"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer">Usage & source</summary>
      {query.isError ? (
        <QueryError title="Could not load usage" retry={query.refetch} />
      ) : query.isLoading ? (
        <p>Loading…</p>
      ) : data ? (
        <div className="mt-2 space-y-2">
          <p>
            {data.scenes.length + data.scripts.length + data.podcasts.length}{" "}
            current references
          </p>
          {data.scenes.map((s) => (
            <Link
              className="block underline"
              key={s.id}
              href={`/editor/${s.scriptId}`}
            >
              {s.label || "Scene"}
            </Link>
          ))}
          {data.scripts.map((s) => (
            <Link
              className="block underline"
              key={s.id}
              href={`/editor/${s.id}`}
            >
              {s.name}
            </Link>
          ))}
          {data.podcasts.map((p) => (
            <Link
              className="block underline"
              key={p.id}
              href={`/podcasts/${p.id}`}
            >
              {p.title}
            </Link>
          ))}
          <p className="text-muted-foreground">
            {data.frozenCount} frozen references. Deletion is blocked while any
            current or frozen reference remains.
          </p>
          {data.frozen.map((reference) => (
            <p key={`${reference.kind}:${reference.id}`}>{reference.label}</p>
          ))}
          {data.frozenCount > data.frozen.length && (
            <p>Showing the first {data.frozen.length} frozen references.</p>
          )}
          {data.provenance ? (
            <pre className="max-h-40 overflow-auto break-words whitespace-pre-wrap">
              {JSON.stringify(data.provenance, null, 2)}
            </pre>
          ) : (
            <p>No source metadata recorded.</p>
          )}
        </div>
      ) : null}
    </details>
  );
}
