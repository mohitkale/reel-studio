import { NextResponse } from "next/server";

import {
  clearMcpToken,
  generateMcpToken,
  hasMcpToken,
} from "@/server/secrets";
import { requireWeb } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * MCP bearer-token management. Website-only (the token is the one secret a human
 * copies into their AI tool's MCP config) — never exposed to MCP-originated
 * requests.
 *
 * Security: GET never returns the raw token (status only). The full token is
 * returned once from POST (generate/rotate) for the operator to copy.
 */

/** GET - whether a token is configured (never returns the secret). */
export async function GET(req: Request) {
  try {
    requireWeb(req);
    return NextResponse.json({
      configured: hasMcpToken(),
      token: null,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST - generate (or rotate) the MCP token and return it once. */
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
