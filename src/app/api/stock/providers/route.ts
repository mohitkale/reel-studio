import { NextResponse } from "next/server";

import { getStockMediaProviderRegistry } from "@/providers/stock/registry";
import { errorResponse } from "@/server/api-helpers";
import { authorize } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    authorize(req);
    const registry = getStockMediaProviderRegistry();
    const providers = await Promise.all(
      registry.listCapabilities().map(async (provider) => ({
        ...provider,
        health: await registry.health(provider.id),
      })),
    );
    return NextResponse.json({ providers });
  } catch (error) {
    return errorResponse(error);
  }
}
