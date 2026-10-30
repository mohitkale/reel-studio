import { authorizeRequest } from "@/server/auth";
import { parseClientInput, readRequestJson } from "@/server/api-helpers";
import { evidencePackSchema } from "@/research/contracts";
import { importExternalEvidence } from "@/library/research-import";
import {
  researchErrorResponse,
  researchRepository,
  researchResponse,
} from "@/server/research-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    authorizeRequest(req, "studio:write");
    const input = parseClientInput(
      evidencePackSchema,
      await readRequestJson(req, { maxBytes: 950_000 }),
    );
    const evidence = await importExternalEvidence(input, researchRepository);
    return researchResponse({ evidence }, 201);
  } catch (error) {
    return researchErrorResponse(error);
  }
}
