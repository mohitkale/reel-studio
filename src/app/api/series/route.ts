import { z } from "zod";

import { authorizeRead, requireWeb } from "@/server/auth";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";
import { getConfig, setSeriesList } from "@/server/app-config";
import { seriesListSchema } from "@/lib/series";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ series: seriesListSchema }).strict();

/** GET /api/series: the saved series (sets of defaults for videos that belong together). */
export async function GET(req: Request) {
  try {
    authorizeRead(req);
    return Response.json({ series: (await getConfig()).series ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}

/** PUT /api/series { series }: replace the whole list. Names must be unique, ignoring case. */
export async function PUT(req: Request) {
  try {
    requireWeb(req);
    const { series } = parseClientInput(bodySchema, await readRequestJson(req));
    const names = new Set<string>();
    for (const item of series) {
      const key = item.name.toLowerCase();
      if (names.has(key))
        return Response.json(
          { error: `Two series are called "${item.name}"` },
          { status: 400 },
        );
      names.add(key);
    }
    return Response.json({
      series: (await setSeriesList(series)).series ?? [],
    });
  } catch (error) {
    return errorResponse(error);
  }
}
