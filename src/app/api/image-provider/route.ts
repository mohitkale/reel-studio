import { NextResponse } from "next/server";

import { authorizeRead, requireWeb } from "@/server/auth";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";
import {
  IMAGE_PROVIDER_DEFAULT_URLS,
  imageProviderConfigStore,
  imageProviderInputSchema,
} from "@/server/image-provider-config";
import { LocalAIEndpointError } from "@/providers/ai/local-endpoint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/image-provider: the optional local image generator, or null when it is off (the default). */
export async function GET(req: Request) {
  try {
    authorizeRead(req);
    return NextResponse.json({
      config: await imageProviderConfigStore.read(),
      defaults: IMAGE_PROVIDER_DEFAULT_URLS,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/image-provider: save the generator's address and model. Only this computer or a private network is allowed. */
export async function POST(req: Request) {
  try {
    requireWeb(req);
    const body = parseClientInput(
      imageProviderInputSchema,
      await readRequestJson(req),
    );
    return NextResponse.json({
      config: await imageProviderConfigStore.save(body),
    });
  } catch (error) {
    if (error instanceof LocalAIEndpointError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return errorResponse(error);
  }
}

/** DELETE /api/image-provider: turn image generation off. Scenes use stock pictures again. */
export async function DELETE(req: Request) {
  try {
    requireWeb(req);
    await imageProviderConfigStore.clear();
    return NextResponse.json({ config: null });
  } catch (error) {
    return errorResponse(error);
  }
}
