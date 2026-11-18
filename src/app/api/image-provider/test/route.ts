import { NextResponse } from "next/server";

import { requireWeb } from "@/server/auth";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";
import { imageProviderInputSchema } from "@/server/image-provider-config";
import { createImageProvider } from "@/providers/image/registry";
import {
  validateLocalAIEndpoint,
  LocalAIEndpointError,
} from "@/providers/ai/local-endpoint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/image-provider/test: check that a generator answers, before saving it. Makes no picture. */
export async function POST(req: Request) {
  try {
    requireWeb(req);
    const body = parseClientInput(
      imageProviderInputSchema,
      await readRequestJson(req),
    );
    await validateLocalAIEndpoint(body.baseUrl, body.allowLan);
    const result = await createImageProvider(body).test(req.signal);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof LocalAIEndpointError)
      return NextResponse.json({ ok: false, message: error.message });
    return errorResponse(error);
  }
}
