import { after, NextResponse } from "next/server";
import {
  authorizeRequest,
  authorizeRead,
  authorizeProviderRequest,
} from "@/server/auth";
import {
  parseClientInput,
  readRequestJson,
  errorResponse,
} from "@/server/api-helpers";
import { editorialCreationRequestSchema } from "@/production/editorial";
import {
  startEditorialWriting,
  runEditorialWriting,
} from "@/library/editorial-writing";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request) {
  try {
    authorizeRequest(req, "studio:write");
    const input = parseClientInput(
      editorialCreationRequestSchema,
      await readRequestJson(req),
    );
    if (input.evidenceId) authorizeRead(req);
    const created = await startEditorialWriting(input);
    after(async () => {
      await runEditorialWriting(created.scriptId, (id) =>
        authorizeProviderRequest(req, [id]),
      );
    });
    return NextResponse.json(created, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
