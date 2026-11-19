import { z } from "zod";

import { authorizeRead, requireWeb } from "@/server/auth";
import {
  errorResponse,
  parseClientInput,
  readRequestJson,
} from "@/server/api-helpers";
import {
  setAutomation,
  setEndTag,
  setOnboarded,
  setReviewBeforeMaking,
  setUiMode,
} from "@/server/app-config";
import { readUiState } from "@/server/ui-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    mode: z.enum(["simple", "pro"]).optional(),
    /** `true` marks first-run setup finished or skipped; `false` shows it again. */
    onboarded: z.boolean().optional(),
    /** Stop for review before a video is made. */
    reviewBeforeMaking: z.boolean().optional(),
    /** End new videos with a one-second "Made with Reel Studio" tag. */
    endTag: z.boolean().optional(),
    /** Which steps run by themselves; only the keys sent change. */
    automation: z
      .object({
        research: z.boolean(),
        voice: z.boolean(),
        music: z.boolean(),
        captions: z.boolean(),
      })
      .partial()
      .strict()
      .optional(),
  })
  .strict();

/** GET /api/ui-mode - the current mode and whether first-run setup should show. */
export async function GET(req: Request) {
  try {
    authorizeRead(req);
    return Response.json(await readUiState());
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/ui-mode - switch Simple/Pro or record first-run setup. Data is never touched. */
export async function POST(req: Request) {
  try {
    requireWeb(req);
    const body = parseClientInput(bodySchema, await readRequestJson(req));
    if (body.mode) await setUiMode(body.mode);
    if (body.onboarded !== undefined) await setOnboarded(body.onboarded);
    if (body.automation) await setAutomation(body.automation);
    if (body.reviewBeforeMaking !== undefined)
      await setReviewBeforeMaking(body.reviewBeforeMaking);
    if (body.endTag !== undefined) await setEndTag(body.endTag);
    return Response.json(await readUiState());
  } catch (error) {
    return errorResponse(error);
  }
}
