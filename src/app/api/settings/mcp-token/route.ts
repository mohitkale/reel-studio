import { NextResponse } from "next/server";

import {
  clearMcpToken,
  generateMcpToken,
  getMcpToken,
  hasMcpToken,
} from "@/server/secrets";
import { requireWeb } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * MCP bearer-token management. Website-only (the token is the one secret a human
 * copies into their AI tool's MCP config) — never exposed to MCP-originated
 * requests. Reveal is safe because the route is same-origin only.
 */

/** GET - current token status and value (for the human to copy). */
export async function GET(req: Request) {
  try {
    requireWeb(req);
    return NextResponse.json({
      configured: hasMcpToken(),
      token: getMcpToken() ?? null,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST - generate (or rotate) the MCP token and return it. */
export async function POST(req: Request) {
  try {
    requireWeb(req);
    const token = await generateMcpToken();
    return NextResponse.json({ configured: true, token });
  } catch (e) {
    return errorResponse(e);
  }
}

/** DELETE - revoke the MCP token, disabling MCP access until regenerated. */
export async function DELETE(req: Request) {
  try {
    requireWeb(req);
    await clearMcpToken();
    return NextResponse.json({ configured: false, token: null });
  } catch (e) {
    return errorResponse(e);
  }
}
