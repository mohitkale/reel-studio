"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { StudioPreset } from "@/lib/studio-preset";
import { apiGet, apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QueryError } from "@/components/ui/query-error";
export function SpeechPresets({
  voice,
  pronunciations,
  onApply,
}: {
  voice?: StudioPreset["voice"];
  pronunciations?: StudioPreset["pronunciations"];
  onApply(preset: StudioPreset): void;
}) {
  const qc = useQueryClient(),
    [name, setName] = useState("");
  const query = useQuery({
    queryKey: ["studio-presets"],
    queryFn: () =>
      apiGet<{ presets: Array<StudioPreset & { id: string }> }>(
        "/api/studio-presets",
      ),
  });
  const save = useMutation({
    mutationFn: () =>
      apiPost("/api/studio-presets", { name, voice, pronunciations }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["studio-presets"] });
      toast.success("Speech preset saved");
      setName("");
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <details className="rounded-lg border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Shared speech presets
      </summary>
      <p className="text-muted-foreground mt-2 text-xs">
        Reuse voices or pronunciation rules across productions. Apply
        explicitly; existing takes remain unchanged. Saving the same name
        updates that preset.
      </p>
      {query.isError && (
        <QueryError title="Could not load presets" retry={query.refetch} />
      )}
      <div className="my-3 flex flex-wrap gap-2">
        {query.data?.presets.map((preset) => (
          <Button
            key={preset.id}
            variant="outline"
            size="sm"
            onClick={() => onApply(preset)}
          >
            {preset.name}
          </Button>
        ))}
      </div>
      <label className="grid gap-1 text-xs">
        Preset name
        <Input
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Weekly interview"
        />
      </label>
      <Button
        className="mt-2"
        size="sm"
        disabled={
          !name.trim() || save.isPending || (!voice && !pronunciations?.length)
        }
        onClick={() => save.mutate()}
      >
        Save current speech settings
      </Button>
    </details>
  );
}
