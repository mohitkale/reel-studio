import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ResearchError,
  ResearchRepository,
} from "@/library/repositories/research";
import {
  normalizeResearchRequest,
  runResearchJob,
  type ResearchAdapterInput,
} from "@/library/research-service";
import { researchSuppliedSources } from "@/library/research-sources";
import {
  assertGeminiResearchReady,
  researchWithGemini,
  ResearchProviderError,
} from "@/providers/research/gemini";
import {
  assertPublicArticleUrl,
  defaultResolveHost,
} from "@/production/source-ingestion";
import { providerPolicyDecision } from "@/production/mcp-access";
import {
  authorizeProviderRequest,
  type RequestAuthorization,
} from "@/server/auth";
import { ClientInputError, errorResponse } from "@/server/api-helpers";
import { ProviderError } from "@/providers/voice/types";
import type { ResearchRequest } from "@/research/contracts";
import { RequestBodyError } from "@/server/request-body";
import {
  assertOpenAIResearchReady,
  researchWithOpenAI,
} from "@/providers/research/openai";

export const researchIdSchema = z.object({ id: z.string().min(1).max(160) });
export const researchRepository = new ResearchRepository();

export function researchResponse(value: unknown, status = 200) {
  const body = JSON.stringify(value);
  if (Buffer.byteLength(body) > 1_000_000)
    throw new ResearchError("Research response exceeds its size limit", 502);
  return new NextResponse(body, {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export function researchErrorResponse(error: unknown) {
  if (error instanceof ResearchError || error instanceof ResearchProviderError)
    return researchResponse({ error: error.message }, error.status);
  if (
    error instanceof ClientInputError ||
    error instanceof ProviderError ||
    error instanceof RequestBodyError
  )
    return errorResponse(error);
  return researchResponse(
    { error: "Research operation failed. Check configuration and try again." },
    500,
  );
}

export async function submitResearch(
  input: ResearchRequest,
  auth: RequestAuthorization,
) {
  const request = normalizeResearchRequest(input);
  await researchRepository.expire();
  const prior = await researchRepository.reconnect(request);
  if (prior) return prior;
  // Cached evidence incurs no new token allowance, even with exhausted quota.
  if (!request.refresh && (await researchRepository.cached(request)))
    return researchRepository.submit(request);
  if (request.mode === "web") {
    if (request.providerId === "openai") assertOpenAIResearchReady(request);
    else assertGeminiResearchReady(request);
    if (auth.origin === "mcp" && auth.token.kind === "named") {
      const decision = providerPolicyDecision(auth.token.record, [
        request.providerId!,
      ]);
      if (!decision.allowed)
        throw new ProviderError(
          decision.reason ?? "Research provider is not permitted",
          403,
        );
    }
  }
  try {
    const signal = AbortSignal.timeout(5000);
    for (const url of request.urls)
      await assertPublicArticleUrl(url, defaultResolveHost, signal);
  } catch {
    throw new ResearchError(
      "Supply public HTTP(S) article URLs on standard ports; private networks and credentials are not allowed",
      400,
    );
  }
  return researchRepository.submit(request);
}

export function executeResearchJob(id: string, req: Request) {
  const adapter = (input: ResearchAdapterInput) =>
    input.request.mode === "web"
      ? input.request.providerId === "openai"
        ? researchWithOpenAI(input)
        : researchWithGemini(input)
      : researchSuppliedSources(input);
  return runResearchJob(id, adapter, {
    repository: researchRepository,
    authorizeProvider: async (providerId) => {
      await authorizeProviderRequest(req, [providerId]);
    },
  });
}
