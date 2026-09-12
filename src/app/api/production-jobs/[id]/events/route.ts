import { NextResponse } from "next/server";

import { productionEventQuerySchema } from "@/production/api";
import { authorizeRequest } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";
import { listProductionJobEvents } from "@/library/repositories/production-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    authorizeRequest(req, "production:submit");
    const { id } = await context.params;
    const query = productionEventQuerySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams),
    );
    const events = await listProductionJobEvents(id, query.after);
    return NextResponse.json({
      events: events.map((event) => ({
        id: event.id,
        type: event.type,
        data: event.dataJson ? JSON.parse(event.dataJson) : null,
        createdAt: event.createdAt.toISOString(),
      })),
      cursor: events.at(-1)?.id ?? query.after,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
