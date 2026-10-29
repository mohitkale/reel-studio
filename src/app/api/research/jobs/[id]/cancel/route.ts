import { authorizeRequest } from "@/server/auth";
import { parseClientInput } from "@/server/api-helpers";
import {
  researchErrorResponse,
  researchIdSchema,
  researchRepository,
  researchResponse,
} from "@/server/research-api";
import { researchJobView } from "@/library/research-service";

export const runtime = "nodejs";
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRequest(req, "studio:write");
    const { id } = parseClientInput(researchIdSchema, await context.params);
    const job = await researchRepository.finish(id, "canceled");
    return job
      ? researchResponse({ job: researchJobView(job) })
      : researchResponse({ error: "Research job not found" }, 404);
  } catch (error) {
    return researchErrorResponse(error);
  }
}
