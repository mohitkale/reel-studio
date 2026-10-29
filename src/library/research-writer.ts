import { getAIProvider } from "@/providers/ai/registry";
import { evidencePackSchema } from "@/research/contracts";
import {
  researchPromptContext,
  researchWriterRequestSchema,
} from "@/research/writer";
import { ResearchError } from "./repositories/research";

/** Consume frozen evidence with one explicit local writer, never a cloud fallback. */
export async function planWithResearchEvidence(
  evidenceInput: unknown,
  requestInput: unknown,
  options: { getProvider?: typeof getAIProvider; signal?: AbortSignal } = {},
) {
  const evidence = evidencePackSchema.parse(evidenceInput);
  const request = researchWriterRequestSchema.parse(requestInput);
  if (request.research.mode === "shared") {
    if (
      evidence.provenance.kind !== "native_search" ||
      evidence.provenance.providerId !== request.research.providerId ||
      evidence.provenance.modelId !== request.research.modelId
    )
      throw new ResearchError(
        "Select the researcher/model that produced this evidence revision. No backend was substituted.",
        400,
      );
  } else if (evidence.provenance.kind === "native_search") {
    throw new ResearchError(
      "Native web evidence needs an explicit shared researcher/model selection.",
      400,
    );
  }
  try {
    researchPromptContext(evidence);
  } catch (error) {
    throw new ResearchError(
      error instanceof Error
        ? error.message
        : "Evidence is not usable by this writer",
      400,
    );
  }
  const signal = options.signal
    ? AbortSignal.any([
        options.signal,
        AbortSignal.timeout(request.budget.deadlineMs),
      ])
    : AbortSignal.timeout(request.budget.deadlineMs);
  signal.throwIfAborted();
  const provider = (options.getProvider ?? getAIProvider)(
    request.writer.providerId,
  );
  const plan = await provider.generatePlan({
    mode: request.mode,
    brief: request.brief,
    sceneCount: request.sceneCount,
    modelId: request.writer.modelId,
    evidence,
    allowStructuredRepair: false,
    signal,
  });
  return {
    plan,
    evidenceId: evidence.id,
    evidenceRevision: evidence.revision,
    research: request.research,
    writer: request.writer,
    attribution: evidence.attribution,
    citations: evidence.sources.map((source) => ({
      id: source.id,
      title: source.title,
      url: source.url,
      provenance: source.provenance,
    })),
    usage: {
      localWriterCalls: 1,
      newProviderCalls: 0,
      newSearchChargeUnits: 0,
    },
    disclosure:
      request.research.mode === "shared"
        ? "The local writer used saved cloud-researched evidence. No new cloud research call was made."
        : "The local writer used supplied sources without cloud search.",
  };
}
