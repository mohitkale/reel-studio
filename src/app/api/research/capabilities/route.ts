import { authorizeRead } from "@/server/auth";
import { researchErrorResponse, researchResponse } from "@/server/research-api";
import {
  GEMINI_RESEARCH_DEFAULT_MODEL,
  GEMINI_RESEARCH_MODELS,
  researchCapability,
} from "@/research/capabilities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    authorizeRead(req);
    return researchResponse({
      version: 1,
      defaultResearchModel: GEMINI_RESEARCH_DEFAULT_MODEL,
      configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      capabilities: GEMINI_RESEARCH_MODELS.map((model) =>
        researchCapability("gemini", model),
      ),
      bounds: {
        maxProviderCalls: 1,
        maxSearchChargeUnits: 1,
        searchChargeUnit: "grounded_prompt",
        maxUrls: 5,
        maxSources: 5,
        maxDeadlineMs: 45_000,
        maxResponseBytes: 1_000_000,
      },
    });
  } catch (error) {
    return researchErrorResponse(error);
  }
}
