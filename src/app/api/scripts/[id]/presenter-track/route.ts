import { NextResponse } from "next/server";

import { authorizeRead } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import { buildReelPresenterTrack } from "@/library/presenter-track";
import { getScript } from "@/library/repositories/scripts";
import { getAssetStore } from "@/library/storage";
import { coverFrames } from "@/video/types";
import { ProviderError } from "@/providers/voice/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/scripts/:id/presenter-track: the presenter's mouth, blinks and nods
 * for the editor's live preview, worked out from the video's captions and its
 * narration. The export computes the same track itself.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRead(req);
    const { id } = await params;
    const script = await getScript(id);
    if (!script) throw new ProviderError("Script not found", 404);
    const track =
      script.captionTracks?.find((t) => t.enabled) ?? script.captionTracks?.[0];
    const take = script.takes[0];
    const fps = script.fps || 30;
    const fromCaptions = (track?.cues ?? []).map((cue) => ({
      id: cue.id,
      startFrame: cue.startFrame,
      endFrame: cue.endFrame,
      text: cue.text,
      words: cue.words,
    }));
    // Without caption cues (a draft has none yet), the narration's own beats carry the words.
    const cues = fromCaptions.length
      ? fromCaptions
      : (take?.timeline ?? []).map((beat) => ({
          id: beat.sceneId,
          startFrame: beat.startFrame,
          endFrame: beat.startFrame + beat.durationFrames,
          text: beat.text,
          words: beat.words?.map((word) => ({
            text: word.text,
            startFrame: word.startFrame,
            endFrame: word.endFrame,
          })),
        }));
    const endFrame = Math.max(
      0,
      ...script.scenes.map(() => 0),
      ...(take?.timeline ?? []).map((b) => b.startFrame + b.durationFrames),
    );
    let wav: Buffer | undefined;
    const key = take?.audioUrl?.replace(/^\/?media\//, "");
    if (key && !key.startsWith("http")) {
      try {
        wav = await getAssetStore().get(key);
      } catch {
        wav = undefined;
      }
    }
    const coverSeconds = coverFrames(fps, Boolean(script.coverUrl)) / fps;
    const result = await buildReelPresenterTrack({
      cues,
      fps,
      coverSeconds,
      totalSeconds: coverSeconds + endFrame / fps,
      seed: script.brandTokens.lookSeed ?? "presenter",
      wav,
    });
    return NextResponse.json({
      mouth: result.mouth,
      blinks: result.blinks,
      accents: result.accents,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
