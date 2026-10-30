import { NextResponse } from "next/server";
import { authorizeRead, authorizeRequest } from "@/server/auth";
import {
  parseClientInput,
  readRequestJson,
  errorResponse,
} from "@/server/api-helpers";
import { productProofControlSchema } from "@/production/product-proof";
import {
  readProductProof,
  controlProductProof,
} from "@/library/product-proof-service";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(req: Request, context: Context) {
  try {
    authorizeRead(req);
    const { id } = await context.params;
    return NextResponse.json(await readProductProof(id), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(req: Request, context: Context) {
  try {
    authorizeRequest(req, "studio:write");
    const { id } = await context.params,
      input = parseClientInput(
        productProofControlSchema,
        await readRequestJson(req),
      );
    return NextResponse.json(await controlProductProof(id, input));
  } catch (error) {
    return errorResponse(error);
  }
}
