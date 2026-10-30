"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAIProviders } from "@/hooks/ai";
import { apiGet, apiPost } from "@/lib/api-client";
import type { MediaVisionJob } from "@/production/media-vision";
import type {
  StockMediaCandidate,
  StockMediaSearchRequest,
} from "@/providers/stock/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
type Context = { sourceHash: string; job?: MediaVisionJob };
export function StockVisionScorer({
  scriptId,
  sceneId,
  providerId,
  search,
  candidates,
  onResult,
}: {
  scriptId: string;
  sceneId: string;
  providerId: string;
  search: StockMediaSearchRequest;
  candidates: StockMediaCandidate[];
  onResult: (job: MediaVisionJob | undefined) => void;
}) {
  const client = useQueryClient(),
    providers = useAIProviders();
  const [modelId, setModelId] = useState(""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["stock-vision-context", scriptId, sceneId],
    queryFn: () =>
      apiGet<Context>(
        `/api/scripts/${scriptId}/media-ranking?sceneId=${encodeURIComponent(sceneId)}`,
      ),
    refetchInterval: (q) =>
      ["queued", "running"].includes(q.state.data?.job?.state ?? "")
        ? 1000
        : false,
  });
  const requestKey = useRef<{ content: string; key: string } | null>(null);
  const job = query.data?.job;
  const matches =
    job?.request.stockProviderId === providerId &&
    job.request.search.query === search.query &&
    job.request.search.kind === search.kind &&
    job.request.search.orientation === search.orientation &&
    job.request.search.pageToken === search.pageToken;
  const applicable =
    matches &&
    job?.state === "ready" &&
    job.sourceHash === query.data?.sourceHash &&
    job.candidates.every((old) =>
      candidates.some(
        (candidate) =>
          candidate.providerAssetId === old.providerAssetId &&
          candidate.previewUrl === old.previewUrl,
      ),
    );
  useEffect(() => {
    onResult(applicable ? job : undefined);
  }, [applicable, job, onResult]);
  const running = job && ["queued", "running"].includes(job.state);
  async function start(fresh = false) {
    if (!query.data) return;
    setPending(true);
    setError("");
    try {
      const input = {
        expectedHash: query.data.sourceHash,
        sceneId,
        stockProviderId: providerId,
        search,
        candidateIds: candidates.slice(0, 6).map((c) => c.providerAssetId),
        modelId: modelId.trim(),
        budget: {
          maxProviderCalls: 1 as const,
          maxImages: 6 as const,
          deadlineMs: 30000,
        },
      };
      const content = JSON.stringify(input);
      if (fresh || requestKey.current?.content !== content)
        requestKey.current = { content, key: `vision:${crypto.randomUUID()}` };
      await apiPost(`/api/scripts/${scriptId}/media-ranking`, {
        ...input,
        idempotencyKey: requestKey.current.key,
      });
      await client.invalidateQueries({
        queryKey: ["stock-vision-context", scriptId, sceneId],
      });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Vision scoring failed",
      );
      await client.invalidateQueries({
        queryKey: ["stock-vision-context", scriptId, sceneId],
      });
    } finally {
      setPending(false);
    }
  }
  async function control(action: "resume" | "cancel") {
    if (!job) return;
    setPending(true);
    setError("");
    try {
      await apiPost(`/api/scripts/${scriptId}/media-ranking/${job.id}`, {
        action,
      });
      await client.invalidateQueries({
        queryKey: ["stock-vision-context", scriptId, sceneId],
      });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Scoring control failed",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <details className="space-y-2 rounded-lg border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Optional vision scoring · separate one-call budget
      </summary>
      <p className="text-muted-foreground mt-2 text-xs">
        Metadata ranking makes no model call. This opt-in sends up to six public
        stock previews and the scene copy to OpenAI. Choose an image-capable
        model; incompatible models fail without fallback or automatic retry.
      </p>
      <label className="block text-sm">
        OpenAI vision model
        <Input
          aria-label="Stock vision model"
          value={modelId}
          maxLength={160}
          onChange={(e) => setModelId(e.target.value)}
          disabled={pending || Boolean(running)}
          placeholder="Enter an image-capable model ID"
        />
      </label>
      <Button
        size="sm"
        variant="outline"
        disabled={
          pending ||
          Boolean(running) ||
          !modelId.trim() ||
          !providers.data?.some((p) => p.id === "openai" && p.configured) ||
          !query.data
        }
        onClick={() => void start(Boolean(job?.callsUsed))}
      >
        {job?.callsUsed
          ? "New scoring request · one OpenAI call"
          : "Score previews · one OpenAI call"}
      </Button>
      {!providers.data?.some(
        (provider) => provider.id === "openai" && provider.configured,
      ) && (
        <p className="text-muted-foreground text-xs">
          OpenAI is not configured; see Settings. Metadata ranking remains
          available.
        </p>
      )}
      {job && (
        <div className="space-y-1 text-sm">
          <p role="status">
            Saved scoring: {job.state} · {job.callsUsed}/1 reserved calls ·{" "}
            {job.request.modelId}
          </p>
          {job.error && <p role="alert">{job.error}</p>}
          {job.state === "ready" && !applicable && (
            <p>
              This score is for an earlier source or candidate set. Current
              metadata ranking is shown.
            </p>
          )}
          {running && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => void control("cancel")}
            >
              Cancel scoring
            </Button>
          )}
          {["failed", "canceled"].includes(job.state) && !job.callsUsed && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => void control("resume")}
            >
              Resume unspent scoring
            </Button>
          )}
        </div>
      )}
      {(error || query.error) && (
        <p role="alert">{error || query.error?.message}</p>
      )}
    </details>
  );
}
