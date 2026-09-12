import { NextResponse } from "next/server";

import { revokeNamedMcpToken } from "@/server/secrets";
import { requireWeb } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireWeb(req);
    const { id } = await context.params;
    const revoked = await revokeNamedMcpToken(id);
    if (!revoked) {
      return NextResponse.json(
        { error: "MCP token not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ revoked: true });
  } catch (error) {
    return errorResponse(error);
  }
}
