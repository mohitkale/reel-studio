import { NextResponse } from "next/server";

import { generateNamedMcpToken, listNamedMcpTokens } from "@/server/secrets";
import { requireWeb } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import { createMcpTokenSchema } from "@/production/mcp-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    requireWeb(req);
    return NextResponse.json({ tokens: listNamedMcpTokens() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    requireWeb(req);
    const input = createMcpTokenSchema.parse(await req.json());
    const created = await generateNamedMcpToken(input);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
