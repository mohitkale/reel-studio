import { withProductionSignal } from "@/library/production-cancellation";
import { z } from "zod";
import { requireWeb, authorizeRead } from "@/server/auth";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";
import {
  audioEditKindSchema,
  saveAudioEditSchema,
  getAudioEdit,
  saveAudioEdit,
  commitAudioEdit,
} from "@/library/audio-edit-service";
export const runtime = "nodejs";
const identity = z.object({
  kind: audioEditKindSchema,
  takeId: z.string().min(1).max(200),
});
export async function GET(req: Request) {
  try {
    authorizeRead(req);
    const input = parseClientInput(
      identity,
      Object.fromEntries(new URL(req.url).searchParams),
    );
    return Response.json({
      session: await getAudioEdit(input.kind, input.takeId),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(req: Request) {
  try {
    requireWeb(req);
    const raw = await readRequestJson(req);
    const input = parseClientInput(
      z.discriminatedUnion("action", [
        saveAudioEditSchema.safeExtend({ action: z.literal("save") }),
        identity.extend({
          action: z.literal("commit"),
          revision: z.number().int().positive(),
        }),
      ]),
      raw,
    );
    return Response.json(
      await withProductionSignal(req.signal, () =>
        input.action === "save"
          ? saveAudioEdit(input)
          : commitAudioEdit(input.kind, input.takeId, input.revision),
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
