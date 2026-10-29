import { authorizeRead } from "@/server/auth";
import { researchErrorResponse, researchResponse } from "@/server/research-api";
import {
  GEMINI_RESEARCH_DEFAULT_MODEL,
  GEMINI_RESEARCH_MODELS,
  OPENAI_RESEARCH_MODELS,
  OPENAI_RESEARCH_DEFAULT_MODEL,
  researchCapability,
} from "@/research/capabilities";
import { listAIProviderStatuses } from "@/providers/ai/registry";
import { MAX_RESEARCH_WRITER_CONTEXT_CHARS } from "@/research/writer";
import { researchCapabilityViewSchema } from "@/research/readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    authorizeRead(req);
    const writers = await listAIProviderStatuses();
    return researchResponse(
      researchCapabilityViewSchema.parse({
        version: 1,
        defaultResearchModel: GEMINI_RESEARCH_DEFAULT_MODEL,
        defaultResearchModels: {
          gemini: GEMINI_RESEARCH_DEFAULT_MODEL,
          openai: OPENAI_RESEARCH_DEFAULT_MODEL,
        },
        configuredProviders: {
          gemini: Boolean(process.env.GEMINI_API_KEY?.trim()),
          openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
        },
        configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
        capabilities: [
          ...GEMINI_RESEARCH_MODELS.map((model) =>
            researchCapability("gemini", model),
          ),
          ...OPENAI_RESEARCH_MODELS.map((model) =>
            researchCapability("openai", model),
          ),
          ...writers
            .filter((writer) => writer.kind === "local")
            .map((writer) =>
              researchCapability(writer.id, writer.defaultModel),
            ),
        ],
        writers,
        bounds: {
          maxProviderCalls: 1,
          maxSearchChargeUnits: 1,
          searchChargeUnits: ["grounded_prompt", "web_search_call"],
          maxUrls: 5,
          maxSources: 5,
          maxDeadlineMs: 45_000,
          maxResponseBytes: 1_000_000,
          maxOutputTokens: 4096,
          maxLocalWriterCalls: 1,
          maxWriterContextChars: MAX_RESEARCH_WRITER_CONTEXT_CHARS,
        },
      }),
    );
  } catch (error) {
    return researchErrorResponse(error);
  }
}
