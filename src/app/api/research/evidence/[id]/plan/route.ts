import { authorizeProviderRequest, authorizeRequest } from "@/server/auth";
import { parseClientInput, readRequestJson } from "@/server/api-helpers";
import { researchWriterRequestSchema } from "@/research/writer";
import { planWithResearchEvidence } from "@/library/research-writer";
import {
  researchErrorResponse,
  researchIdSchema,
  researchRepository,
  researchResponse,
} from "@/server/research-api";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRequest(req, "studio:write");
    const { id } = parseClientInput(researchIdSchema, await context.params);
    const request = parseClientInput(
      researchWriterRequestSchema,
      await readRequestJson(req, { maxBytes: 32_000 }),
    );
    await authorizeProviderRequest(req, [request.writer.providerId]);
    const evidence = await researchRepository.getEvidence(id);
    if (!evidence)
      return researchResponse({ error: "Evidence revision not found" }, 404);
    return researchResponse(
      await planWithResearchEvidence(evidence, request, { signal: req.signal }),
    );
  } catch (error) {
    return researchErrorResponse(error);
  }
}
