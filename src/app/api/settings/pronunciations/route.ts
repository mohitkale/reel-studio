import { z } from "zod";

import { authorizeRead, requireWeb } from "@/server/auth";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";
import { getConfig, setPronunciations } from "@/server/app-config";
import { STARTER_PRONUNCIATIONS } from "@/lib/speech-normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    rules: z
      .array(
        z
          .object({
            find: z.string().trim().min(1).max(60),
            replaceWith: z.string().trim().min(1).max(120),
          })
          .strict(),
      )
      .max(500),
  })
  .strict();

/** GET /api/settings/pronunciations: your respellings and the bundled starter list. */
export async function GET(req: Request) {
  try {
    authorizeRead(req);
    return Response.json({
      rules: (await getConfig()).pronunciations ?? [],
      starter: STARTER_PRONUNCIATIONS,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/settings/pronunciations { rules }: replace your respellings. */
export async function POST(req: Request) {
  try {
    requireWeb(req);
    const { rules } = parseClientInput(bodySchema, await readRequestJson(req));
    const config = await setPronunciations(rules);
    return Response.json({ rules: config.pronunciations ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}
