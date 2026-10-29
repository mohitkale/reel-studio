import { after } from "next/server";
import { researchRequestSchema } from "@/research/contracts";
import { authorizeRequest } from "@/server/auth";
import { parseClientInput, readRequestJson } from "@/server/api-helpers";
import {
  executeResearchJob,
  researchErrorResponse,
  researchResponse,
  submitResearch,
} from "@/server/research-api";
import { researchJobView } from "@/library/research-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const auth = authorizeRequest(req, "studio:write");
    const input = parseClientInput(
      researchRequestSchema,
      await readRequestJson(req, { maxBytes: 256_000 }),
    );
    const job = await submitResearch(input, auth);
    // The job survives client disconnect. Re-POST its key to resume queued work.
    if (job.state === "queued")
      after(async () => {
        await executeResearchJob(job.id, req);
      });
    return researchResponse(
      { job: researchJobView(job) },
      job.state === "succeeded" ? 200 : 202,
    );
  } catch (error) {
    return researchErrorResponse(error);
  }
}
