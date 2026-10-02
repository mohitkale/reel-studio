import { NextResponse } from "next/server";
import { z } from "zod";

import { requireWeb, authorizeRead } from "@/server/auth";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";
import { localAIConfigStore } from "@/server/local-ai-config";
import {
  LOCAL_AI_PROVIDER_IDS,
  localAIProviderConfigInputSchema,
} from "@/providers/ai/local-types";
import { LocalAIEndpointError } from "@/providers/ai/local-endpoint";
import { diagnoseLocalAIProvider } from "@/providers/ai/local-diagnostics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    providerId: z.enum(LOCAL_AI_PROVIDER_IDS),
    config: localAIProviderConfigInputSchema,
  })
  .strict();

export async function GET(req: Request) {
  try {
    authorizeRead(req);
    return NextResponse.json({ providers: await localAIConfigStore.list() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    requireWeb(request);
    const body = parseClientInput(bodySchema, await readRequestJson(request));
    const provider = await localAIConfigStore.save(
      body.providerId,
      body.config,
    );
    return NextResponse.json({ provider });
  } catch (error) {
    if (error instanceof LocalAIEndpointError) {
      return NextResponse.json(
        { error: error.message, providerId: error.providerId },
        { status: error.status },
      );
    }
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    requireWeb(request);
    const { providerId } = parseClientInput(
      z.object({ providerId: z.enum(LOCAL_AI_PROVIDER_IDS) }).strict(),
      await readRequestJson(request),
    );
    const config = await localAIConfigStore.readProvider(providerId);
    const diagnostic = await diagnoseLocalAIProvider(providerId, config);
    await localAIConfigStore.recordDiagnostic(providerId, diagnostic);
    return NextResponse.json({ diagnostic });
  } catch (error) {
    if (error instanceof LocalAIEndpointError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    return errorResponse(error);
  }
}
