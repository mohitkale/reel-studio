import { NextResponse } from "next/server";

import { deletePodcastTake } from "@/library/repositories/podcasts";
import { authorize } from "@/server/auth";
import { ProviderError } from "@/providers/voice/types";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    if (authorize(req) === "mcp") {
      throw new ProviderError("Deletion is not available via MCP", 403);
    }
    const { id } = await ctx.params;
    await deletePodcastTake(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
