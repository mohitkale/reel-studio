import { z } from "zod";
import { authorizeRead, requireWeb } from "@/server/auth";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";
import { localAIConfigStore } from "@/server/local-ai-config";
import { listAIProviderStatuses, getAIProvider } from "@/providers/ai/registry";
import { LOCAL_AI_PROVIDER_IDS } from "@/providers/ai/local-definitions";
import { probeCreationProvider } from "@/providers/ai/readiness";
import { AIError } from "@/providers/ai/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read saved configuration only. Opening a creator never runs inference or downloads. */
export async function GET(req: Request) {
  try {
    authorizeRead(req);
    const [local, providers] = await Promise.all([
      localAIConfigStore.list(),
      listAIProviderStatuses(),
    ]);
    return Response.json({
      local,
      connected: providers.filter((provider) => provider.kind === "cloud"),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    requireWeb(req);
    const input = parseClientInput(
      z
        .object({
          providerId: z.enum(LOCAL_AI_PROVIDER_IDS),
          language: z.enum(["English", "Hindi", "Hinglish"]).default("English"),
        })
        .strict(),
      await readRequestJson(req),
    );
    const config = await localAIConfigStore.readProvider(input.providerId);
    if (!config.modelId)
      throw new AIError(
        "Select an installed local model in Settings first.",
        400,
      );
    await localAIConfigStore.recordGenerationProbe(
      input.providerId,
      undefined,
      config,
    );
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(60_000)]);
    const probe = await probeCreationProvider(
      getAIProvider(input.providerId),
      config.modelId,
      input.language,
      signal,
    );
    await localAIConfigStore.recordGenerationProbe(
      input.providerId,
      probe,
      config,
    );
    return Response.json({ probe });
  } catch (error) {
    return errorResponse(error);
  }
}
