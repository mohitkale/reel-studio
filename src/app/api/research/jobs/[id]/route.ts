import { authorizeRead } from "@/server/auth";
import { parseClientInput } from "@/server/api-helpers";
import {
  researchErrorResponse,
  researchIdSchema,
  researchRepository,
  researchResponse,
} from "@/server/research-api";
import { researchJobView } from "@/library/research-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRead(req);
    const { id } = parseClientInput(researchIdSchema, await context.params);
    await researchRepository.expire();
    const job = await researchRepository.getJob(id);
    return job
      ? researchResponse({ job: researchJobView(job) })
      : researchResponse({ error: "Research job not found" }, 404);
  } catch (error) {
    return researchErrorResponse(error);
  }
}
