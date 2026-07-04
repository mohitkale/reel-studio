import { NextResponse } from "next/server";
import { z } from "zod";

import { MUSIC_PROVIDER_IDS, MusicProviderError } from "@/providers/music/types";
import { getMusicProvider } from "@/providers/music/registry";
import { musicKeyStatus, setMusicKey } from "@/server/secrets";
import { requireWeb } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  providerId: z.enum(MUSIC_PROVIDER_IDS),
  apiKey: z.string(), // empty string clears the key
});

/** GET /api/music/keys - which music providers currently have a key. */
export async function GET() {
  try {
    return NextResponse.json({ status: musicKeyStatus() });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/music/keys - set or clear a music provider key, then best-effort verify via a search. */
export async function POST(req: Request) {
  try {
    requireWeb(req);
    const { providerId, apiKey } = bodySchema.parse(await req.json());
    await setMusicKey(providerId, apiKey);

    if (!apiKey.trim()) {
      return NextResponse.json({ status: musicKeyStatus(), cleared: true });
    }

    let verified = false;
    let verifyError: string | undefined;
    try {
      await getMusicProvider().search("uplifting", 1);
      verified = true;
    } catch (e) {
      verifyError =
        e instanceof MusicProviderError || e instanceof Error
          ? e.message
          : "Could not verify the key.";
    }

    return NextResponse.json({ status: musicKeyStatus(), verified, verifyError });
  } catch (e) {
    return errorResponse(e);
  }
}
