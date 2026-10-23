import { z } from "zod";
import { requireWeb, authorizeRead } from "@/server/auth";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";
import {
  languageSource,
  translateLanguageVersion,
  saveLanguageVersion,
  translationRequestSchema,
  languageProposalSchema,
} from "@/library/language-versions";
export const runtime = "nodejs";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRead(req);
    const source = await languageSource((await params).id);
    return Response.json({
      sourceHash: source.sourceHash,
      paragraphs: source.paragraphs,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireWeb(req);
    const input = parseClientInput(
      z.discriminatedUnion("action", [
        translationRequestSchema.extend({ action: z.literal("preview") }),
        languageProposalSchema.extend({ action: z.literal("save") }),
      ]),
      await readRequestJson(req),
    );
    const { id } = await params;
    return Response.json(
      input.action === "preview"
        ? await translateLanguageVersion(id, input)
        : await saveLanguageVersion(id, input),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
