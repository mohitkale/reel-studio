import type { ResearchJob } from "@prisma/client";
import { ResearchRepository } from "@/library/repositories/research";
import {
  EMPTY_RESEARCH_USAGE,
  evidencePackSchema,
  researchRequestSchema,
  type EvidencePack,
  type ResearchRequest,
  type ResearchUsage,
} from "@/research/contracts";
import { GEMINI_RESEARCH_DEFAULT_MODEL } from "@/research/capabilities";

export interface ResearchAdapterInput {
  request: ResearchRequest;
  signal: AbortSignal;
  /** Reserve usage durably immediately before starting the external request. */
  onProviderCall: () => Promise<void>;
}
export type ResearchAdapter = (
  input: ResearchAdapterInput,
) => Promise<EvidencePack>;

async function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let abort: () => void = () => {};
  const stopped = new Promise<never>((_, reject) => {
    abort = () => reject(new Error("Research stopped"));
    signal.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([work, stopped]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
}

export function normalizeResearchRequest(input: unknown) {
  const request = researchRequestSchema.parse(input);
  return {
    ...request,
    modelId:
      request.mode === "web"
        ? (request.modelId ?? GEMINI_RESEARCH_DEFAULT_MODEL)
        : undefined,
  };
}

/** At most one execution wins the persistent claim, across requests/processes. */
export async function runResearchJob(
  id: string,
  adapter: ResearchAdapter,
  options: {
    repository?: ResearchRepository;
    authorizeProvider?: () => Promise<void>;
  } = {},
) {
  const repository = options.repository ?? new ResearchRepository();
  const job = await repository.claim(id);
  if (!job) return repository.getJob(id);
  const request = normalizeResearchRequest(JSON.parse(job.requestJson));
  const controller = new AbortController();
  const remaining = job.deadlineAt.getTime() - Date.now();
  const deadline = setTimeout(() => controller.abort(), Math.max(0, remaining));
  let polling = false;
  const poll = setInterval(() => {
    if (polling) return;
    polling = true;
    void repository
      .getJob(id)
      .then((current) => {
        if (current?.state !== "running") controller.abort();
      })
      .catch(() => controller.abort())
      .finally(() => {
        polling = false;
      });
  }, 200);
  let calls = 0;
  try {
    const pack = evidencePackSchema.parse(
      await abortable(
        adapter({
          request,
          signal: controller.signal,
          onProviderCall: async () => {
            controller.signal.throwIfAborted();
            if (
              calls ||
              request.mode !== "web" ||
              request.budget.maxProviderCalls < 1 ||
              request.budget.maxSearchChargeUnits < 1
            )
              throw new Error("Research provider budget exhausted");
            calls++;
            await options.authorizeProvider?.();
            controller.signal.throwIfAborted();
            const usage: ResearchUsage = {
              ...EMPTY_RESEARCH_USAGE,
              providerCalls: 1,
              searchChargeUnits: 1,
              searchQueries: null,
              inputTokens: null,
              outputTokens: null,
              accounting: "reserved",
            };
            if (!(await repository.recordUsage(id, usage)))
              throw new Error("Research job no longer running");
          },
        }),
        controller.signal,
      ),
    );
    controller.signal.throwIfAborted();
    if (pack.usage.providerCalls !== calls)
      throw new Error("Research usage mismatch");
    return await repository.publish(id, pack);
  } catch {
    // External exceptions can contain URLs, page content or credentials.
    const current = await repository.getJob(id);
    if (current?.state === "canceled") return current;
    return repository.finish(
      id,
      "failed",
      controller.signal.aborted
        ? "Research stopped or exceeded its deadline. No automatic provider retry."
        : "Research failed. Check configuration, model support and quota; inspect usage before an explicit refresh.",
    );
  } finally {
    clearTimeout(deadline);
    clearInterval(poll);
  }
}

export function researchJobView(job: ResearchJob) {
  return {
    id: job.id,
    state: job.state,
    evidenceId: job.evidenceId,
    createdAt: job.createdAt.toISOString(),
    deadlineAt: job.deadlineAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
    error: job.error,
    usage: JSON.parse(job.usageJson) as ResearchUsage,
  };
}
