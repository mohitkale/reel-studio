import { NextResponse } from "next/server";
import { authorizeRequest } from "@/server/auth";
import {
  errorResponse,
  readRequestJson,
  parseClientInput,
} from "@/server/api-helpers";
import { factoryProfileRequestSchema } from "@/production/factory";
import { publishFactoryProfile } from "@/library/factory-service";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    authorizeRequest(req, "studio:write");
    const profile = await publishFactoryProfile(
      parseClientInput(factoryProfileRequestSchema, await readRequestJson(req)),
    );
    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
