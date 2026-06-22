import { NextResponse } from "next/server";
import { z } from "zod";

import { getAIProvider, isAIProviderId } from "@/providers/ai/registry";
import { AIError, AI_PROVIDER_IDS } from "@/providers/ai/types";
import { aiKeyStatus, setAIKey } from "@/server/secrets";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  providerId: z.enum(AI_PROVIDER_IDS),
  apiKey: z.string(),
});

export async function GET() {
  try {
    return NextResponse.json({ status: aiKeyStatus() });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/ai/keys - set or clear an AI key, then best-effort verify via listModels. */
export async function POST(req: Request) {
  try {
    const { providerId, apiKey } = bodySchema.parse(await req.json());
    if (!isAIProviderId(providerId)) {
      throw new AIError(`Unknown AI provider "${providerId}"`, 404);
    }

    await setAIKey(providerId, apiKey);

    if (!apiKey.trim()) {
      return NextResponse.json({ status: aiKeyStatus(), cleared: true });
    }

    let verified = false;
    let modelCount: number | undefined;
    let verifyError: string | undefined;
    try {
      const models = await getAIProvider(providerId).listModels();
      verified = true;
      modelCount = models.length;
    } catch (e) {
      verifyError = e instanceof Error ? e.message : "Could not verify the key.";
    }

    return NextResponse.json({
      status: aiKeyStatus(),
      verified,
      modelCount,
      verifyError,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
