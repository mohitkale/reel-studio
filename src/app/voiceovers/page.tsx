"use client";
import { VoiceoverBatch } from "@/components/studio/voiceover-batch";
import Link from "next/link";
import { useState } from "react";
import { useProjects } from "@/hooks/script";
import { CreationWizard } from "@/components/projects/creation-wizard";
import { PageHeader } from "@/components/shell/page-header";
import { QueryError } from "@/components/ui/query-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
export default function VoiceoversPage() {
  const query = useProjects();
  const [search, setSearch] = useState("");
  const projects =
    query.data?.filter(
      (p) =>
        p.outputType === "voiceover" &&
        !p.archivedAt &&
        p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
    ) ?? [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Voiceover studio"
        description="Write paragraphs, audition voices, compare takes and finish your audio."
        actions={
          <CreationWizard
            initialOutputType="voiceover"
            trigger={<Button>New voiceover</Button>}
          />
        }
      />
      <VoiceoverBatch />
      <Input
        aria-label="Search voiceovers"
        placeholder="Search voiceovers…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {query.isError && (
        <QueryError
          title="Could not load voiceovers"
          error={query.error}
          retry={query.refetch}
        />
      )}{" "}
      {query.isLoading ? (
        <Skeleton className="h-40" />
      ) : !query.isError && projects.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6">
          {search
            ? "No matching voiceovers."
            : "Create your first voiceover from a script. Each paragraph can have its own takes."}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <article
              key={p.id}
              className="bg-card space-y-3 rounded-xl border p-4"
            >
              <h2 className="font-semibold">{p.name}</h2>
              <p className="text-muted-foreground text-sm">
                {p.sceneCount} paragraphs ·{" "}
                {p.status === "ready" ? "Audio available" : "Draft"}
              </p>
              <Button asChild>
                <Link href={`/voiceovers/${p.firstScriptId}`}>
                  Open voiceover
                </Link>
              </Button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
