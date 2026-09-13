import { NextResponse } from "next/server";

import { listVideoEngines } from "@/engines/registry";
import { PRODUCTION_PRESETS } from "@/production/presets";
import { authorizeRequest } from "@/server/auth";
import { errorResponse } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    authorizeRequest(req, "studio:read");
    return NextResponse.json({
      presets: PRODUCTION_PRESETS,
      engines: listVideoEngines().map((engine) => ({
        id: engine.id,
        label: engine.label,
        description: engine.description,
        defaultTemplateId: engine.defaultTemplateId,
        capabilities: engine.capabilities,
      })),
      limits: {
        videoSeconds: 180,
        audioSeconds: 180,
        podcastSeconds: 600,
        audiogramSeconds: 90,
        batchItems: 10,
        batchFormatVariants: 3,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
