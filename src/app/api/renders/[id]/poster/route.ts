import { getRenderPoster } from "@/library/repositories/renders";
import { ProviderError } from "@/providers/voice/types";
import { errorResponse } from "@/server/api-helpers";
import { authorizeMedia } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    authorizeMedia(request);
    const { id } = await context.params;
    const jpg = await getRenderPoster(id);
    if (!jpg) throw new ProviderError("Video preview unavailable", 404);
    return new Response(Uint8Array.from(jpg), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
