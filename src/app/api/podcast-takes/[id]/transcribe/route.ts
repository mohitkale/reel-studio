import { z } from "zod";
import { requireWeb } from "@/server/auth";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";
import {
  reviewedTranscriptSchema,
  saveReviewedPodcastTranscript,
  transcribePodcastRecording,
} from "@/library/podcast-transcription";
import { withProductionSignal } from "@/library/production-cancellation";
export const runtime = "nodejs";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireWeb(req);
    const input = parseClientInput(
      z.discriminatedUnion("action", [
        z.object({
          action: z.literal("transcribe"),
          language: z.string().max(12).default("auto"),
        }),
        z.object({ action: z.literal("save"), cues: reviewedTranscriptSchema }),
      ]),
      await readRequestJson(req),
    );
    const { id } = await params;
    const take = await withProductionSignal(req.signal, () =>
      input.action === "transcribe"
        ? transcribePodcastRecording(id, input.language)
        : saveReviewedPodcastTranscript(id, input.cues),
    );
    return Response.json({ take });
  } catch (error) {
    return errorResponse(error);
  }
}
