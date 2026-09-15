import { NextResponse } from "next/server";
import { z } from "zod";

import { getStockMediaProviderRegistry } from "@/providers/stock/registry";
import {
  stockMediaSearchRequestSchema,
  stockProviderIdSchema,
} from "@/providers/stock/schemas";
import { errorResponse } from "@/server/api-helpers";
import { requireWeb } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const searchSchema = z
  .object({
    providerId: stockProviderIdSchema,
    request: stockMediaSearchRequestSchema,
  })
  .strict();

export async function POST(req: Request) {
  try {
    requireWeb(req);
    const input = searchSchema.parse(await req.json());
    const result = await getStockMediaProviderRegistry().search(
      input.providerId,
      input.request,
    );
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
