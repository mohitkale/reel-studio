import { requireWeb } from "@/server/auth";
import { readBoundedBody, AUDIO_UPLOAD_BYTES } from "@/server/request-body";
import { errorResponse } from "@/server/api-helpers";
import { importPodcastAudio } from "@/library/podcast-import";
export const runtime = "nodejs";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireWeb(req);
    const { id } = await params;
    const bytes = await readBoundedBody(req, AUDIO_UPLOAD_BYTES);
    return Response.json(
      { take: await importPodcastAudio(id, Buffer.from(bytes)) },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
