import { NextResponse } from "next/server";
import { z } from "zod";

import { PROVIDER_IDS } from "@/providers/voice/types";
import {
  getConfig,
  setDefaultModel,
  setDefaultProvider,
} from "@/server/app-config";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  defaultProviderId: z.enum(PROVIDER_IDS).optional(),
  modelFor: z.enum(PROVIDER_IDS).optional(),
  modelId: z.string().optional(),
});

/** POST /api/settings/defaults - set the default provider and/or a provider's default model. */
export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());

    if (body.defaultProviderId) {
      await setDefaultProvider(body.defaultProviderId);
    }
    if (body.modelFor && body.modelId) {
      await setDefaultModel(body.modelFor, body.modelId);
    }

    return NextResponse.json({ config: await getConfig() });
  } catch (e) {
    return errorResponse(e);
  }
}
