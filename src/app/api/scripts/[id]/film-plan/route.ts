import { NextResponse } from "next/server";
import { z } from "zod";
import {
  readFilmPlanDocument,
  saveFilmPlanDocument,
} from "@/library/film-plan-service";
import { saveFilmPlanRequestSchema } from "@/production/film-plan-document";
import { authorizeRead, authorize } from "@/server/auth";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const querySchema = z
  .object({
    voiceTakeId: z.string().min(1).max(240).optional(),
    revisionId: z.string().min(1).max(240).optional(),
  })
  .strict()
  .refine(
    (query) => !(query.voiceTakeId && query.revisionId),
    "Choose a take or a frozen revision",
  );
type Context = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: Context) {
  try {
    authorizeRead(req);
    const query = parseClientInput(
      querySchema,
      Object.fromEntries(new URL(req.url).searchParams),
    );
    return NextResponse.json(
      await readFilmPlanDocument((await context.params).id, query),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request, context: Context) {
  try {
    authorize(req);
    const body = parseClientInput(
      saveFilmPlanRequestSchema,
      await readRequestJson(req),
    );
    return NextResponse.json(
      await saveFilmPlanDocument((await context.params).id, body.document),
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
