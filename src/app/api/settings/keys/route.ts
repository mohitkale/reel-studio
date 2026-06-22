import { NextResponse } from "next/server";
import { z } from "zod";

import { getProvider, isProviderId } from "@/providers/voice/registry";
import { ProviderError, PROVIDER_IDS } from "@/providers/voice/types";
import { keyStatus, setKey } from "@/server/secrets";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  providerId: z.enum(PROVIDER_IDS),
  apiKey: z.string(), // empty string clears the key
});

/** GET /api/settings/keys - which providers currently have a key. */
export async function GET() {
  try {
    return NextResponse.json({ status: keyStatus() });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * POST /api/settings/keys - set or clear a provider key, then best-effort
 * verify it by listing voices (no credits spent). Saving always succeeds even
 * if verification fails, so the user can correct a typo.
 */
export async function POST(req: Request) {
  try {
    const { providerId, apiKey } = bodySchema.parse(await req.json());
    if (!isProviderId(providerId)) {
      throw new ProviderError(`Unknown provider "${providerId}"`, 404);
    }

    await setKey(providerId, apiKey);

    if (!apiKey.trim()) {
      return NextResponse.json({ status: keyStatus(), cleared: true });
    }

    let verified = false;
    let voiceCount: number | undefined;
    let verifyError: string | undefined;
    try {
      const voices = await getProvider(providerId).listVoices();
      verified = true;
      voiceCount = voices.length;
    } catch (e) {
      verifyError =
        e instanceof Error ? e.message : "Could not verify the key.";
    }

    return NextResponse.json({
      status: keyStatus(),
      verified,
      voiceCount,
      verifyError,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
