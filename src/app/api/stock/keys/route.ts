import { NextResponse } from "next/server";
import { z } from "zod";

import { STOCK_PROVIDER_IDS, StockError } from "@/providers/stock/types";
import { getStockProvider } from "@/providers/stock/registry";
import { stockKeyStatus, setStockKey } from "@/server/secrets";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  providerId: z.enum(STOCK_PROVIDER_IDS),
  apiKey: z.string(), // empty string clears the key
});

/** GET /api/stock/keys - which stock providers currently have a key. */
export async function GET() {
  try {
    return NextResponse.json({ status: stockKeyStatus() });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/stock/keys - set or clear a stock key, then best-effort verify via a search. */
export async function POST(req: Request) {
  try {
    const { providerId, apiKey } = bodySchema.parse(await req.json());
    await setStockKey(providerId, apiKey);

    if (!apiKey.trim()) {
      return NextResponse.json({ status: stockKeyStatus(), cleared: true });
    }

    let verified = false;
    let verifyError: string | undefined;
    try {
      await getStockProvider().search("nature", "portrait", 1);
      verified = true;
    } catch (e) {
      verifyError =
        e instanceof StockError || e instanceof Error
          ? e.message
          : "Could not verify the key.";
    }

    return NextResponse.json({ status: stockKeyStatus(), verified, verifyError });
  } catch (e) {
    return errorResponse(e);
  }
}
