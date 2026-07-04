import { NextResponse } from "next/server";

import { getMusicProvider } from "@/providers/music/registry";
import { authorize } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/music/search?q=... - search the configured external music provider
 * (e.g. Jamendo) for tracks matching a free-text mood/vibe query. Returns an
 * empty list (never an error) when no provider is configured, so the editor's
 * music picker can call this unconditionally.
 */
export async function GET(req: Request) {
  try {
    authorize(req);
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const provider = getMusicProvider();

    if (!q || !provider.isConfigured()) {
      return NextResponse.json({ tracks: [], configured: provider.isConfigured() });
    }

    const tracks = await provider.search(q, 8);
    return NextResponse.json({ tracks, configured: true });
  } catch (e) {
    return errorResponse(e);
  }
}
