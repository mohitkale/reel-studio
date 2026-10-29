import { authorizeRead } from "@/server/auth";
import { parseClientInput } from "@/server/api-helpers";
import {
  researchErrorResponse,
  researchIdSchema,
  researchRepository,
  researchResponse,
} from "@/server/research-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRead(req);
    const { id } = parseClientInput(researchIdSchema, await context.params);
    const evidence = await researchRepository.getEvidence(id);
    return evidence
      ? researchResponse({ evidence })
      : researchResponse({ error: "Evidence revision not found" }, 404);
  } catch (error) {
    return researchErrorResponse(error);
  }
}
