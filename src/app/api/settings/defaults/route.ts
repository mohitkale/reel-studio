import { NextResponse } from "next/server";
import { z } from "zod";

import { PROVIDER_IDS } from "@/providers/voice/types";
import { KOKORO_VOICE_IDS } from "@/providers/voice/kokoro";
import {
  getConfig,
  setDefaultModel,
  setDefaultProvider,
  setKokoroVisibleVoices,
} from "@/server/app-config";
import { requireWeb } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const kokoroIdSet = new Set<string>(KOKORO_VOICE_IDS);

const bodySchema = z.object({
  defaultProviderId: z.enum(PROVIDER_IDS).optional(),
  modelFor: z.enum(PROVIDER_IDS).optional(),
  modelId: z.string().optional(),
  /**
   * Kokoro voice whitelist. `null` resets to all voices. An array keeps only
   * those ids (unknown ids are dropped). Empty array also resets to all.
   */
  kokoroVisibleVoiceIds: z.array(z.string()).nullable().optional(),
});

/** POST /api/settings/defaults - set default provider/model and Kokoro voice visibility. */
export async function POST(req: Request) {
  try {
    requireWeb(req);
    const body = bodySchema.parse(await req.json());

    if (body.defaultProviderId) {
      await setDefaultProvider(body.defaultProviderId);
    }
    if (body.modelFor && body.modelId) {
      await setDefaultModel(body.modelFor, body.modelId);
    }
    if (body.kokoroVisibleVoiceIds !== undefined) {
      const next =
        body.kokoroVisibleVoiceIds === null
          ? null
          : body.kokoroVisibleVoiceIds.filter((id) => kokoroIdSet.has(id));
      await setKokoroVisibleVoices(next);
    }

    return NextResponse.json({ config: await getConfig() });
  } catch (e) {
    return errorResponse(e);
  }
}
