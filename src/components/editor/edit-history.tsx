"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
export function EditHistory({
  scriptId,
  onRestored,
}: {
  scriptId: string;
  onRestored?(): void;
}) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["scene-history", scriptId],
    queryFn: () =>
      apiGet<{ history: Array<{ sequence: number; undone: boolean }> }>(
        `/api/scripts/${scriptId}/history`,
      ),
  });
  const mutation = useMutation({
    mutationFn: (action: "undo" | "redo") =>
      apiPost(`/api/scripts/${scriptId}/history`, { action }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["script", scriptId] });
      onRestored?.();
      void qc.invalidateQueries({ queryKey: ["scene-history", scriptId] });
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      aria-label="Saved scene edit history"
    >
      <Button
        size="sm"
        variant="outline"
        disabled={
          mutation.isPending || !query.data?.history.some((e) => !e.undone)
        }
        onClick={() => mutation.mutate("undo")}
      >
        Undo scene edit
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={
          mutation.isPending || !query.data?.history.some((e) => e.undone)
        }
        onClick={() => mutation.mutate("redo")}
      >
        Redo
      </Button>
      {query.isError && (
        <Button size="sm" variant="ghost" onClick={() => void query.refetch()}>
          Retry history
        </Button>
      )}
    </div>
  );
}
